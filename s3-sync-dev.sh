#!/bin/bash
kicker -c -e 's3cmd -vfrP --exclude="*swp" --exclude=".git*" sync . s3://dev.notational-vapor.apps.lmorchard.com/'
