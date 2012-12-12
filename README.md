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
    * [Notebook](http://thenounproject.com/noun/notebook/#icon-No4512) - Monika Ciapala, from The Noun Project
    * [Cloud upload](http://thenounproject.com/noun/cloud-upload/#icon-No2787) - P.J. Onori, from The Noun Project
* Additional icons from The Noun Project:
    * [Magnifying Glass](http://thenounproject.com/noun/magnifying-glass/#icon-No3017) - Ana Carolina Santos, from The Noun Project
    * [Pencil](http://thenounproject.com/noun/pencil/#icon-No1170)
    * [Gear](http://thenounproject.com/noun/gear/#icon-No1329)
    * <a href="http://thenounproject.com/noun/document/#icon-No5034" target="_blank">Document</a> designed by <a href="http://thenounproject.com/DmitryBaranovskiy" target="_blank">Dmitry Baranovskiy</a> from The Noun Project

## TODO

* Trap back button (for android, etal) with History API
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
    * Might depend on the storage driver
* markdown preview?
* other storage drivers
    * Amazon S3 (cors?)
    * Evernote API
    * RemoteStorage
    * LocalStorage
    * WebDav
    * Local FS?
* clean up and refactor this nasty nasty code, in general
    * consider not nuking and rebuilding notes list with every change in data
        model or search filtering.
* consider using docco to turn the code into a blog post
* start using [grunt](http://gruntjs.com/) for deployment and etc?
