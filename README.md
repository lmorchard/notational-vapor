# notational-vapor

I like [Notational Velocity](http://notational.net/). I like
[Dropbox](http://dropbox.com). Sometimes, I keep my notes from Notational
Velocity in Dropbox.

This is an attempt to use [dropbox-js](https://github.com/dropbox/dropbox-js)
to build a Notational Velocity inspired notetaking web app.

Someday, this may grow up to be an installable [Open Web
App](https://developer.mozilla.org/en-US/apps) and work in
[FirefoxOS](http://www.mozilla.org/en-US/b2g/).

Or, I may get bored and wander off before it's done. But, the (really crappy)
code is here, at least!

## Credits

* Logo composed from [The Noun Project](http://thenounproject.com/) icons

## TODO

* restrict characters accepted for titles, some are inappropriate for filenames (eg. "/")
* table / data grid for document list - sortable columns, last modified
* Draggable divider between doc list and editor?
* app cache manifest!
* example docs when app folder empty (eg. blank slate experience)
* dropbox auth status and log-out link in upper right
* delete notes
* save button
* button to force-refresh note list
* handle errors
* search note bodies... somehow?
* clean up and refactor this nasty nasty code
* markdown preview?
* other storage APIs
    * s3, evernote, webdav
