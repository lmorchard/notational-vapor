// TODO: Do something more AMD-ish, here.
window.app = (function () {

var conf = {
    IDLE_TIMEOUT: 1000,
    REFRESH_TIMEOUT: 10000,
    ARROW_SELECTION_DELAY: 350,
    DROPBOX_CONF: {
        key: "/nmTfjZ3FnA=|r8bRfJP/iOYWc43sc0s1dccq65ih7rNzI9UnbEdDXw==",
        sandbox: true
    }
};

var KEYS = {
    DELETE: 8,
    RETURN: 13,
    UP: 38,
    DOWN: 40,
};

var ui_id = '#main-ui';
var ui_el = $(ui_id);
var search_el = $(ui_id + ' .search input');
var notelist_el = $(ui_id + ' .notes table');
var note_el = $(ui_id + ' .note textarea');

var notes = [];
var idle_timer = null;
var load_timer = null;
var loading = false;
var saving = false;
var should_refresh_notes = false;
var curr_note_fn = false;
var curr_note_saved = false;
var client;

/**
 * Main driver
 */
function main () {
    connectToStorage(wireupUI);

    // Exports
    return {
        selectNote: selectNote,
        getSelectedNote: getSelectedNote
    };
}

/**
 * Wire up the UI elements
 */
function wireupUI () {
    // Start with search focused.
    search_el[0].focus();

    // This form shouldn't do anything on submission
    ui_el.submit(function (ev) {
        return false;
    });

    // Handle tabs and indents more helpfully
    $.fn.tabOverride.tabSize(4).autoIndent(true);
    note_el.tabOverride(true);

    // Set flag to check for new notes every REFRESH_TIMEOUT seconds.
    setInterval(function () {
        should_refresh_notes = true;
    }, conf.REFRESH_TIMEOUT);

    // Load new note on list selection change.
    notelist_el.click(function (ev) {
        startIdleTimer();
        var row = $(ev.target).parent('tr');
        if (row.length) {
            selectNote(row.data('value'));
        }
        return false;
    });

    // Watch note typing activity to wait for idle time
    note_el.keypress(function (ev) {
        startIdleTimer();
    });

    // Focusing the search field switches to searching mode
    search_el.focus(function (ev) {
        startIdleTimer();
        ui_el.removeClass('editing').addClass('searching');
    });

    // Capture some keypresses in the search field.
    search_el.keypress(function (ev) {
        startIdleTimer();

        // Switch from editing to search mode.
        ui_el.removeClass('editing').addClass('searching');

        if (KEYS.RETURN == ev.keyCode) {
            return handleSearchReturn();
        } else if (KEYS.UP == ev.keyCode) {
            return handleSearchArrow(true);
        } else if (KEYS.DOWN == ev.keyCode) {
            return handleSearchArrow(false);
        } else {
            // Defer reaction to other search text entry, so filtering gets
            // access to the updated text field.
            setTimeout(handleSearchTyping, 0.1);
        }
    });
}

/**
 * Select the given filename in the list, and schedule it for loading.
 */
function selectNote (fn, skip_loading, load_delay) {
    notelist_el.find('tr.selected').removeClass('selected');
    notelist_el.find('tr').each(function () {
        var row = $(this);
        if (fn == row.data('value')) {
            row.addClass('selected');
            if (!skip_loading) {
                if (!load_delay) {
                    return loadNote(fn);
                } else {
                    if (load_timer) { clearTimeout(load_timer); }
                    load_timer = setTimeout(function () {
                        loadNote(fn);
                    }, load_delay);
                }
            }
        }
    });
}

/**
 * Deselect currently selected note, if any.
 */
function deselectNote () {
    curr_note_fn = null;
    note_el.val('');
    notelist_el.find('tr:selected').removeClass('selected');
}

/**
 * Find the currently-selected note filename in the list.
 */
function getSelectedNote () {
    return notelist_el.find('tr.selected').data('value');
}

/**
 * Start or re-start the UI activity idle timer.
 */
function startIdleTimer () {
    if (idle_timer) { clearTimeout(idle_timer); }
    idle_timer = setTimeout(function () {
        handleIdle();
    }, conf.IDLE_TIMEOUT);
}

/**
 * Perform some tasks when we're idle (eg. save, refresh note list, etc)
 */
function handleIdle () {
    maybeSaveNote();
    if (should_refresh_notes) {
        should_refresh_notes = false;
        loadNoteList(refreshNoteList);
    }
}

/**
 * Typing in the search box filters down the notes list.
 */
function handleSearchTyping () {
    // Refreshing filters by the current contents of the search field.
    refreshNoteList();

    // Now, we might have something do to based on what results are left...
    var rows = notelist_el.find('tr');
    if (rows.length == 1) {
        // If there's just one search result left, select it.
        return selectNote(rows.data('value'));
    } else if (rows.length == 0) {
        // If there are no search results left, we'll create a new note if the
        // user hits return.
        search_el.parent().removeClass('searching').addClass('creating');
    } else {
        // Multiple results, so we're in search mode.
        search_el.parent().removeClass('creating').addClass('searching');
    }
}

/**
 * Hitting return in the search box creates a new note, if that exact title
 * doesn't already exist.
 */
function handleSearchReturn () {
    var search_txt = (''+search_el.val()).toLowerCase();
    if (!search_txt) { return; }

    // Look for a pre-existing match, bail if found.
    var exists = false;
    $.each(notes, function (idx, item) {
        if (search_txt == item.label.toLowerCase()) {
            exists = true;
        }
    });
    if (exists) { return; }

    // Create a blank note, if no pre-existing.
    note_el.val('');
    curr_note_fn = search_el.val() + '.txt';
    curr_note_saved = '';
    note_el[0].focus();
}

/**
 * An up/down arrow steps through the search results, selecting the next/prev
 * note, with wraparound to first/last.
 */
function handleSearchArrow (is_up) {
    var wrap_pos = is_up ? 'last' : 'first';
    var nav_dir = is_up ? 'prev' : 'next';

    var selected = notelist_el.find('tr.selected');
    var fn = false;
    if (0 == selected.length) {
        // With nothing selected, the wrap_pos item gets selected
        fn = notelist_el.find('tr:' + wrap_pos).data('value');
    } else {
        // Cycle up, with wraparound.
        var row = selected[nav_dir]('tr');
        if (row.length) {
            fn = row.data('value');
        } else {
            fn = notelist_el.find('tr:' + wrap_pos).data('value');
        }
    }
    // If there's a selection, select it but delay loading to anticipate
    // successive navigation events.
    if (fn) { selectNote(fn, false, conf.ARROW_SELECTION_DELAY); }
}

/**
 * Refresh the note list from loaded items, filtering by the contents of the
 * search field using case-insensitive match.
 */
function refreshNoteList () {
    var search = (''+search_el.val()).toLowerCase();
    // TODO: Someday, do this more incrementally, rather than nuke and rebuild.
    notelist_el.empty();
    $.each(notes, function (idx, item) {
        // TODO: Fuzzier search algo?
        var label_txt = item.label.toLowerCase();
        if (search && (-1 == label_txt.indexOf(search))) { return; }
        var row = document.createElement('tr');
        var c1 = document.createElement('td');
        $(c1).text(item.label);
        $(row).attr('data-value', item.id)
              .append(c1);
        notelist_el.append(row);
    });
    if (curr_note_fn) {
        // Re-select currently loaded note, if any, but don't re-load.
        selectNote(curr_note_fn, true);
    }
}

/**
 * Connect to the Dropbox storage provider
 */
function connectToStorage (cb) {
    ui_el.addClass('loading');
    client = new Dropbox.Client(conf.DROPBOX_CONF);
    client.authDriver(new Dropbox.Drivers.Redirect({
        rememberUser: true
    }));
    client.authenticate(function(err, client) {
        if (err) { return; }
        loadNoteList(function () {
            refreshNoteList();
            ui_el.removeClass('loading');
            return cb();
        });
    });
}

/**
 * Load the list of notes from storage.
 */
function loadNoteList (cb) {
    notes = [];
    client.readdir('/', function (err, entries) {
        entries.forEach(function (entry) {
            if ('.' == entry.substr(0,1)) { return; }
            if ('.txt' != entry.substr(-4)) { return; }
            notes.push({
                id: entry, 
                label: entry.substr(0, entry.length - 4)
            });
        });
        cb(notes);
    });
}

/**
 * Load the note, if not already loading.
 */
function loadNote (fn) {
    if (!fn) { return; }
    loading = true;
    ui_el.addClass('loading').removeClass('searching').addClass('editing');
    client.readFile(fn, function (err, data) {
        loading = false;
        ui_el.removeClass('loading');
        if (err) { return false; };
        note_el.val(data);
        curr_note_fn = fn;
        curr_note_saved = data;
    });
}

/**
 * Save the note, if loaded, not currently saving, and contents changed.
 */
function maybeSaveNote () {
    if (!curr_note_fn || saving) { return; }
    var curr_note_txt = note_el.val();
    if (curr_note_saved == curr_note_txt) { return; }
    ui_el.addClass('saving');
    saving = true;
    client.writeFile(curr_note_fn, curr_note_txt, function (err, stat) {
        saving = false;
        ui_el.removeClass('saving');
        if (err) { return; }
        curr_note_saved = curr_note_txt;
    });
}

/**
 * Delete the currently selected note.
 */
function removeSelectedNote () {
    var path = curr_note_fn;
    deselectNote();
    client.remove(path, function (err, stat) {
        loadNoteList(refreshNoteList);
    });
    return false;
}

return main();

})();
