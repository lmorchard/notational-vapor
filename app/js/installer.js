if (!navigator.mozApps) {
    $('#install').hide();
} else {
    $('#install').click(function (ev) {
        var webapp_path = "http://" + location.host + "/index.webapp";
        var request = navigator.mozApps.install(webapp_path);
        request.onsuccess = function() {
            alert("INSTALLED OK!");
        }
        request.onerror = function() {
            alert("FAILED INSTALLATION!");
        }
    });
    var request = navigator.mozApps.getSelf();
    request.onsuccess = function() {
        if (request.result) {
            $('#install-status').text("Installed.");
        }
    }
    request.onerror = function() {
      alert('Error checking installation status: ' + this.error.message);
    }
}
