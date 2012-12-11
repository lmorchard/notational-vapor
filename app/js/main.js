(function () {

var conf = {
    IDLE_TIMEOUT: 1000,
    SAVE_TIMEOUT: 2000,
    REFRESH_TIMEOUT: 5000,
    LOAD_SELECTION_TIMEOUT: 250,
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
var search_load = null;
var is_idle = true;
var idle_timer = null;
var saving = false;
var curr_note_fn = false;
var curr_note_saved = false;
var client;

function main () {
    connectToDropbox(wireupUI);
}

function connectToDropbox (cb) {
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
            cb();
        });
    });
}

function wireupUI () {
    // Start with search focused.
    search_el[0].focus();

    // This form shouldn't do anything on submission
    ui_el.submit(function (ev) { return false; });

    // Load new note on list selection change.
    notelist_el.click(function (ev) {
        var row = $(ev.target).parent('tr');
        if (row.length) {
            notelist_el.find('tr').removeClass('selected');
            row.addClass('selected');
            selectNote(row.attr('data-value'));
            loadSelectedNote();
        }
    });

    notelist_el.keypress(function (ev) {
        if (KEYS.DELETE == ev.keyCode) {
            // Remove selected note on delete
            return removeSelectedNote();
        }
    });
    
    // Check for new notes every 10 sec
    /*
    setInterval(function () {
        loadNoteList(refreshNoteList);
    }, conf.REFRESH_TIMEOUT);
    */

    // Check for need to save every 1 sec
    setInterval(function () {
        maybeSaveNote();
    }, conf.SAVE_TIMEOUT);

    // Watch note typing activity to wait for idle time
    note_el.keypress(function (ev) {
        is_idle = false;
        if (idle_timer) { clearTimeout(idle_timer); }
        idle_timer = setTimeout(function () {
            is_idle = true;
        }, conf.IDLE_TIMEOUT);
    });

    // Handle tabs and indents more helpfully
    $.fn.tabOverride.tabSize(4).autoIndent(true);
    note_el.tabOverride(true);

    // Focusing the search field switches to searching mode
    search_el.focus(function (ev) {
        ui_el.removeClass('editing').addClass('searching');
    });

    // Capture some keypresses in the search field.
    search_el.keypress(function (ev) {
        // Switch from editing to search mode.
        ui_el.removeClass('editing').addClass('searching');

        if (KEYS.RETURN == ev.keyCode) {
            return handleSearchReturn();
        } else if (KEYS.UP == ev.keyCode) {
            return handleSearchUpArrow();
        } else if (KEYS.DOWN == ev.keyCode) {
            return handleSearchDownArrow();
        } else {
            // Defer reaction to other search text entry, so filtering gets
            // access to the updated text field.
            setTimeout(handleSearchTyping, 0.1);
        }
    });
}

function handleSearchReturn () {
    var search_txt = (''+search_el.val()).toLowerCase();
    if (!search_txt) { return; }

    // Look for a pre-existing match, ignore return if found.
    var exists = false;
    $.each(notes, function (idx, item) {
        if (search_txt == item.label.toLowerCase()) {
            exists = true;
        }
    });

    // Create a blank note, if no pre-existing.
    if (!exists) {
        note_el.val('');
        curr_note_fn = search_el.val() + '.txt';
        curr_note_saved = '';
        note_el[0].focus();
    }
}

function handleSearchTyping () {
    refreshNoteList();
    var opts = notelist_el.find('option');
    if (opts.length == 1) {
        opts.attr('selected', true);
        return loadSelectedNote();
    } else if (opts.length == 0) {
        search_el.parent().removeClass('searching').addClass('creating');
    } else {
        search_el.parent().removeClass('creating').addClass('searching');
        var search_txt = (''+search_el.val()).toLowerCase();
        notelist_el.find('option').each(function () {
            var el = $(this);
            var el_txt = (''+el.text()).toLowerCase();
            if (el_txt == search_txt) {
                el.attr('selected', true);
                return loadSelectedNote();
            }
        });
    }
}

function handleSearchUpArrow () {
    var selected = notelist_el.find('option:selected');
    if (0 == selected.length) {
        // With nothing selected, the last item gets selected
        notelist_el.find('option:last').attr('selected', true);
    } else {
        // Cycle up, with wraparound.
        var el = notelist_el
            .find('option:selected').attr('selected', null)
            .prev('option');
        if (el.length) {
            el.attr('selected', true);
        } else {
            notelist_el.find('option:last').attr('selected', true);
        }
    }
    return loadSelectedNote();
}

function handleSearchDownArrow () {
    var selected = notelist_el.find('option:selected');
    if (0 == selected.length) {
        // With nothing selected, the first item gets selected.
        notelist_el.find('option:first').attr('selected', true);
    } else {
        // Cycle down, with wraparound.
        var el = notelist_el
            .find('option:selected').attr('selected', null)
            .next('option');
        if (el.length) {
            el.attr('selected', true);
        } else {
            notelist_el.find('option:first').attr('selected', true);
        }
    }
    return loadSelectedNote();
}

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

function refreshNoteList () {
    var search = (''+search_el.val()).toLowerCase();
    notelist_el.empty();
    $.each(notes, function (idx, item) {
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
        notelist_el.find('option').each(function () {
            var el = $(this);
            if (el.val() == curr_note_fn) {
                el.attr('selected', true);
            }
        });
    }
}

function deselectNote () {
    curr_note_fn = null;
    note_el.val('');
}

function selectNote (fn) {
    curr_note_fn = fn;
}

function removeSelectedNote () {
    var path = notelist_el.val();
    deselectNote();
    client.remove(path, function (err, stat) {
        loadNoteList(refreshNoteList);
    });
    return false;
}

function loadSelectedNote () {
    loadNote(curr_note_fn);
    /*
    if (search_load) { clearTimeout(search_load); }
    search_load = setTimeout(function () {
        loadNote(curr_note_fn);
    }, conf.LOAD_SELECTION_TIMEOUT);
    */
    return false;
}

function loadNote (fn) {
    //if (!fn) { return; }
    //if (fn == curr_note_fn) { return; }
    ui_el.addClass('loading').removeClass('searching').addClass('editing');
    client.readFile(fn, function (err, data) {
        if (err) { return false; };
        note_el.val(data);
        curr_note_fn = fn;
        curr_note_saved = data;
        ui_el.removeClass('loading');
    });
}

function maybeSaveNote () {
    if (!curr_note_fn || !is_idle || saving) { return; }
    var curr_note_txt = note_el.val();
    if (curr_note_saved != curr_note_txt) {
        saving = true;
        client.writeFile(curr_note_fn, curr_note_txt, function (err, stat) {
            if (err) { return; }
            saving = false;
            curr_note_saved = curr_note_txt;
            loadNoteList(refreshNoteList);
        });
    }
}

main();

})();
