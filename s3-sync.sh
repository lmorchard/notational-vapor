#!/bin/bash
kicker -c -e 's3cmd -vfrP --exclude="*swp" --exclude=".git*" sync . s3://notational-vapor.lmorchard.com/'
