//
// 
//
(function () {

var conf = {
    IDLE_TIMEOUT: 1000,
    SAVE_TIMEOUT: 2000,
    REFRESH_TIMEOUT: 10000,
    LOAD_SELECTION_TIMEOUT: 250,
    DROPBOX_CONF: {
        key: "361ljvjgjcxd7ci",
        secret: "f992wj038qmiow5",
        sandbox: true
    }
};

var ui_id = '#main-ui';
var search_el = $(ui_id + ' .search');
var notelist_el = $(ui_id + ' .notes');
var note_el = $(ui_id + ' .note');
var notes = [];
var search_load = null;
var is_idle = true;
var idle_timer = null;
var saving = false;
var curr_note_fn = false;
var curr_note_saved = false;
var client;

function main () {
    $('body').addClass('loading');
    wireupUI();

    client = new Dropbox.Client(conf.DROPBOX_CONF);
    client.authDriver(new Dropbox.Drivers.Redirect({
        rememberUser: true
    }));

    client.authenticate(function(err, client) {
        if (err) { return; }
        loadNoteList(function () {
            refreshNoteList();
            $('body').removeClass('loading');
        });
    });
}

function wireupUI () {
    // Start with search focused.
    search_el[0].focus();

    // This form shouldn't do anything on submission
    $(ui_id).submit(function (ev) { return false; });

    // Load new note on list selection change.
    notelist_el.change(loadSelectedNote);
    
    // Check for new notes every 10 sec
    setInterval(function () {
        loadNoteList(refreshNoteList);
    }, conf.REFRESH_TIMEOUT);

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

    // Capture some keypresses in the search field.
    // search_el.keyup(function (ev) {
    search_el.keypress(function (ev) {
        var selected = notelist_el.find('option:selected');

        if (13 == ev.keyCode) { // Return key
            var search_txt = (''+search_el.val()).toLowerCase();
            if (!search_txt) { return; }

            // Look for a pre-existing match, select if found.
            var loaded = false;
            notelist_el.find('option').each(function () {
                var el = $(this);
                var el_txt = (''+el.text()).toLowerCase();
                if (el_txt == search_txt) {
                    el.attr('selected', true);
                    loaded = true;
                    return loadSelectedNote();
                }
            });

            // Create a blank note, if nothing loaded.
            if (!loaded) {
                note_el.val('');
                curr_note_fn = search_el.val() + '.txt';
                curr_note_saved = '';
                note_el.focus();
            }

        } else if (38 == ev.keyCode) { // Up arrow...
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
        
        } else if (40 == ev.keyCode) { // Down arrow...
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
        
        } else {
            // Typing results in a refresh of the note list with search
            refreshNoteList();
            var opts = notelist_el.find('option');
            if (opts.length == 1) {
                opts.attr('selected', true);
                return loadSelectedNote();
            } else {
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
    });
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
        var c = document.createElement('option');
        c.innerHTML = item.label;
        c.value = item.id;
        notelist_el.append(c);
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

function loadSelectedNote () {
    if (search_load) { clearTimeout(search_load); }
    search_load = setTimeout(function () {
        loadNote(notelist_el.val());
    }, conf.LOAD_SELECTION_TIMEOUT);
    return false;
}

function loadNote (fn) {
    if (!fn) { return; }
    if (fn == curr_note_fn) { return; }
    $('body').addClass('loading');
    client.readFile(fn, function (err, data) {
        if (err) { return false; };
        note_el.val(data);
        curr_note_fn = fn;
        curr_note_saved = data;
        $('body').removeClass('loading');
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
        });
    }
}

main();

})();
