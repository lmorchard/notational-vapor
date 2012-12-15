// TODO: Do something more AMD-ish, here.
window.app = (function () {

var conf = {
    IDLE_TIMEOUT: 1000,
    REFRESH_TIMEOUT: 10000,
    LONGPRESS_TIMEOUT: 500,
    ARROW_SELECTION_DELAY: 350,
    SEARCH_UPDATE_INTERVAL: 1000,
    DROPBOX_CONF: {
        key: "/nmTfjZ3FnA=|r8bRfJP/iOYWc43sc0s1dccq65ih7rNzI9UnbEdDXw==",
        sandbox: true
    }
};

var notes = [];
var idle_timer = null;
var load_timer = null;
var search_timer = null;
var loading = false;
var saving = false;
var should_refresh_notes = false;
var curr_note_fn = false;
var curr_note_saved = false;
var client;

var ui_id = '#main-ui';
var ui_el = $(ui_id);
var search_el = $(ui_id + ' .search input');
var notelist_el = $(ui_id + ' .notes table');
var note_el = $(ui_id + ' .note textarea');

var KEY_DELETE = 8;
var KEY_RETURN = 13;
var KEY_ESC = 27;
var KEY_UP = 38;
var KEY_DOWN = 40;

var MOUSE_LEFT = 1;
var MOUSE_MIDDLE = 2;
var MOUSE_RIGHT = 3;

// Routes to dispatch on hash change
// TODO: Use a better router
var HASH_ROUTES = [
    ['^#search/(.*)', function (m) {
        gotoSearchMode(decodeURIComponent(m[1]));
    }],
    ['^#search', function (m) {
        gotoSearchMode();
    }],
    ['^#notes/(.*)', function (m) {
        selectNote(decodeURIComponent(m[1]));
    }]
];

/**
 * Main driver
 */
function main () {
    $(document).ready(function () {
        connectToStorage(wireupUI);
    });

    // Exports
    return {
        gotoSearchMode: gotoSearchMode,
        selectNote: selectNote,
        getSelectedNote: getSelectedNote
    };
}

/**
 * Wire up the UI elements
 */
function wireupUI () {
    buildSpinner();

    // This form shouldn't do anything on submission
    ui_el.submit(function (ev) { return false; });

    // Handle tabs and indents more helpfully
    $.fn.tabOverride.tabSize(4).autoIndent(true);
    note_el.tabOverride(true);

    // Set flag to check for new notes every REFRESH_TIMEOUT seconds.
    setInterval(function () {
        should_refresh_notes = true;
    }, conf.REFRESH_TIMEOUT);

    // Bump the idle timer on clicks or keypresses that bubble up to the
    // document body, which should be most we care about.
    $(document.body)
        .click(startIdleTimer)
        .keypress(startIdleTimer);

    // Focusing the search field switches to searching mode
    search_el.focus(function (ev) {
        gotoSearchMode();
    });

    // Capture some keypresses in the search field.
    search_el.keypress(handleNavKeypress);

    // HACK: Editing in the search field on mobile devices seems not to result
    // in keypresses, so this periodically polls the field while in editing
    // mode.
    search_timer = setInterval(function () {
        if (!ui_el.hasClass('searching')) { return; }
        handleSearchChange();
    }, conf.SEARCH_UPDATE_INTERVAL);

    // Single quick click selects a note. But, a long click and a right click
    // are handled as a "meta" click. Currently, that just means delete, but
    // could summon a menu someday.
    var longpress_timer = null;
    notelist_el
        .mousedown(function (ev) {
            // A long click is a mousedown without a mouseup for a long time
            if (MOUSE_LEFT != ev.which) { return; } 
            longpress_timer = setTimeout(function () {
                longpress_timer = null;
                handleNoteListMetaClick(ev);
            }, conf.LONGPRESS_TIMEOUT);
        })
        .mouseup(function (ev) {
            // If mouseup before longpress timer fires, this is a click
            if (MOUSE_LEFT != ev.which) { return; } 
            if (!longpress_timer) { return; }
            clearTimeout(longpress_timer);
            longpress_timer = null;
            return handleNoteListClick(ev);
        })
        .contextmenu(function (ev) {
            handleNoteListMetaClick(ev);
            return false;
        });

    // Use location.hash as a within-app URL for view routing.
    dispatchHash();
    window.addEventListener('popstate', dispatchHash);

    // Start in search mode, by default.
    if (!location.hash) {
        gotoSearchMode();
    }
}

/**
 * Dispatch an appropriate action based on the location hash.
 * TODO: Use a better router here, this is a bit crap
 */
function dispatchHash (ev) {
    var hash = location.hash;
    for (var i=0; i < HASH_ROUTES.length; i++) {
        var route = HASH_ROUTES[i];
        var re = new RegExp(route[0]);
        var m = re.exec(hash);
        if (m) { route[1](m); break; }
    }
}

/**
 * Push an update to the location hash, if necessary.
 */
function pushHashChange (hash) {
    if (!hash || location.hash == hash) { return; }
    window.history.pushState(null, null, hash);
}

/**
 * Switch to search mode.
 */
function gotoSearchMode (term) {
    // If already in search mode, bail.
    if (ui_el.hasClass('searching')) { return; }
    search_el[0].focus();
    ui_el.removeClass('editing').addClass('searching');
    if (!term) {
        pushHashChange('#search');
    } else {
        alert(term);
        search_el.val(term);
        refreshNoteList();
        pushHashChange('#search/' + encodeURIComponent(term));
    }
}

/**
 * Programmatically build and inject the spinner into the UI DOM.
 */
function buildSpinner () {
    var spinner_el = $('<div id="floatingBarsG"></div>');
    for (var i=1; i<9; i++) {
        var id = 'rotateG_0' + i;
        spinner_el.append('<div class="blockG" id="' + id + '"></div>');
    }
    ui_el.append(spinner_el);
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
    // TODO: Should all of this be made more async / callback driven?
    maybeSaveNote();
    if (should_refresh_notes) {
        should_refresh_notes = false;
        loadNoteList(refreshNoteList);
    }
}

/**
 * Handle click on the notes list, selects note.
 */
function handleNoteListClick (ev) {
    var row = $(ev.target).parent('tr');
    if (!row.length) { return; }

    if (row.hasClass('selected')) {
        summonNoteItemRename(row);
    } else {
        selectNote(row.data('value'));
    }
}

/**
 * Initiate the renaming of a note item.
 */
function summonNoteItemRename (row) {
    var fn = row.data('value');
    var label = fn.substr(0, fn.length - 4);

    // Nuke any existing rename fields, just in case.
    ui_el.find('textarea.rename').remove();

    // Build and wire up a new in-place rename field.
    $('<textarea class="rename"></textarea>')
        // Cover up the original note item's position & size
        .offset(row.offset())
        .css({width: row[0].offsetWidth, height: row[0].offsetHeight})
        // Blur cancels the rename and removes the field.
        .blur(function (ev) {
            $(this).remove(); 
        })
        // Catch a couple of significant keypresses...
        .keypress(function (ev) {
            switch (ev.keyCode) {
                case KEY_ESC: // Escape cancels
                    $(this).remove();
                    return false;
                case KEY_RETURN: // Return commits
                    var name = $(this).val();
                    alert("NAME " + name);
                    $(this).remove();
                    return false;
            }
        })
        .appendTo(ui_el)
        .val(label).focus().select();
}

/**
 * Handle "meta" click, invokes additional actions on note.
 */
function handleNoteListMetaClick (ev) {
    var row = $(ev.target).parent('tr');
    if (!row.length) { return; }

    console.log("DELETE", row.data('value'));
}

/**
 * Handle navigation keypresses in the search field.
 */
function handleNavKeypress (ev) {
    switch (ev.keyCode) {
        case KEY_RETURN:
            return handleSearchReturn();
        case KEY_UP:
            return handleSearchArrow(true);
        case KEY_DOWN:
            return handleSearchArrow(false);
        case KEY_ESC:
            search_el.val('');
            return handleSearchChange();
        default:
            // Defer reaction to other search text entry, so filtering gets
            // access to the updated text field.
            setTimeout(handleSearchChange, 0.1);
    }
}

/**
 * Select the given filename in the list, and schedule it for loading.
 */
function selectNote (fn, skip_loading, load_delay, skip_scrolling) {
    // Search for row matching the given filename.
    var row = null;
    notelist_el.find('tr').each(function () {
        // TODO: Could probably do this with a selector on the data-value
        // attribute, but afraid some filenames will break the selector syntax
        // without escaping (which I haven't learned to do yet)
        var el = $(this);
        if (fn == el.data('value')) { row = el; }
    });
    if (!row) { return; }

    // Ensure only the matching row is selected.
    notelist_el.find('tr.selected').removeClass('selected');
    row.addClass('selected');

    if (!skip_scrolling) {
        // Ensure the notelist is scrolled such that the selected row is visible.
        var scroll_top = notelist_el[0].scrollTop;
        var scroll_height = notelist_el[0].offsetHeight;
        var row_top = row[0].offsetTop;
        var row_bottom = row_top + row[0].offsetHeight;
        if (row_top < scroll_top) {
            // Scroll up to reveal item at top
            notelist_el[0].scrollTop = row_top;
        } else if (row_bottom > scroll_top + scroll_height) {
            // Scroll down just enough to reveal item at bottom
            notelist_el[0].scrollTop = row_bottom - scroll_height;
        }
    }

    // Finally, load if necessary, with a delay if any.
    if (!skip_loading) {
        
        // Update the location to reflect the selected note.
        pushHashChange('#notes/' + encodeURIComponent(fn));

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

/**
 * Deselect currently selected note, if any.
 */
function deselectNote () {
    curr_note_fn = null;
    note_el.val('');
    notelist_el.find('tr.selected').removeClass('selected');
}

/**
 * Find the currently-selected note filename in the list.
 */
function getSelectedNote () {
    return notelist_el.find('tr.selected').data('value');
}

/**
 * Typing in the search box filters down the notes list.
 */
function handleSearchChange () {
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

        // Also, update the current hash based on search terms.
        var term = search_el.val();
        var search_hash = '#search';
        if (term) {
            search_hash += '/' + encodeURIComponent(term);
        }
        if (search_hash != location.hash) {
            window.history.replaceState(null, null, search_hash);
        }
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
    
    // TODO: Someday, do this more incrementally, rather than nuke and rebuild.
    var term = search_el.val();
    var term_lc = (''+term).toLowerCase();
    notelist_el.empty();
    $.each(notes, function (idx, item) {
        // TODO: Fuzzier search algo?
        var label_txt = item.label.toLowerCase();
        if (term_lc && (-1 == label_txt.indexOf(term_lc))) { return; }
        var row = document.createElement('tr');
        var c1 = document.createElement('td');
        $(c1).addClass('label').text(item.label);
        $(row).attr('data-value', item.id)
              .append(c1);
        notelist_el.append(row);
    });
    if (curr_note_fn) {
        // Re-select currently loaded note, skip reload and scroll.
        selectNote(curr_note_fn, true, 0, true);
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
    client.readdir('/', function (err, entries, folder_stat, file_stats) {
        for (var i=0; i < file_stats.length; i++) {
            var fs = file_stats[i];
            if (!fs.isFile) { continue; }
            if ('.' == fs.name.substr(0, 1)) { continue; }
            if ('.txt' != fs.name.substr(-4)) { continue; }
            var note = {
                id: fs.name, 
                label: fs.name.substr(0, fs.name.length - 4),
                modified: fs.modifiedAt
            };
            notes.push(note);
        }
        // Sort by most recently modified
        // TODO: Make this an option
        notes.sort(function (b, a) {
            var am = a.modified;
            var bm = b.modified;
            return (am > bm) ? 1 : ((am < bm) ? -1 : 0);
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
