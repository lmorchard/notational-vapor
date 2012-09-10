//
// 
//
(function () {

var conf = {
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
    search_el.keyup(function (ev) {
        if (38 == ev.keyCode) {
            console.log("UP");
        }
        if (40 == ev.keyCode) {
            console.log("DOWN");
        }
        refreshNoteList();
    });

    notelist_el.click(function () {
        loadNote(notelist_el.val());
    });
    notelist_el.change(function () {
        loadNote(notelist_el.val());
    });
    
    setInterval(function () {
        maybeSaveNote();
        loadNoteList(refreshNoteList);
    }, 5000);
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
    var search = search_el.val();
    notelist_el.empty();
    $.each(notes, function (idx, item) {
        if (search && (-1 == item.label.indexOf(search))) { return; }
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

function loadNote (fn) {
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
    var curr_note_txt = note_el.val();
    if (!saving && curr_note_saved != curr_note_txt) {
        saving = true;
        client.writeFile(curr_note_fn, curr_note_txt, function (err, stat) {
            if (err) { return; }
            saving = false;
            curr_note_saved = curr_note_txt;
            console.dir(stat);
        });
    }
}

main();

})();
