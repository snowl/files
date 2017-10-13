# files
The simplest file server you can find. Perfect for ShareX.

## Installing

Ensure that you have NodeJS and the Typescript installer installed on your machine.

Run `mkdir uploads` to create the uploads folder.
Run `npm install` for the first run to retrieve all the dependencies.
Run `tsc` to compile the server to be run.

### Database

The files server requires a SQLite database to be created. This file should be called database.db and located in this folder.

Run the database.db.sql script, making sure to change the auth token with your own custom token. This token should be kept secret otherwise other users can upload files to your server without your knowledge. You can use a UUID or a randomly generated password here - you do not need to remember this!

### NginX

NginX has a simple setup that forwards all requests from a subdomain to a port on your machine.

```
server {
        listen 80;
        listen [::]:80;

        client_max_body_size 0;
        server_name files.your.url;

        location / {
                proxy_pass http://127.0.0.1:4651;
                proxy_http_version 1.1;
                proxy_set_header Upgrade $http_upgrade;
                proxy_set_header Connection 'upgrade';
                proxy_set_header Host $host;
                proxy_set_header X-Forwarded-For $remote_addr;
                proxy_cache_bypass $http_upgrade;
        }

        location ~ /.well-known {
                allow all;
        }
}
```

This will forward all requests from http://files.your.url to port `4561`, which is where the server is running. You can change this in server.ts.

### ShareX

You can import the files within ./ShareX, changing the auth token to the one you set in the database setup, and the url to your url.

### Testing

Now that you have the server compiled, NginX, and ShareX setup, you can now test your file server.

Run `npm run start` to see if the server starts up correctly, and navigate to the URL to see if you get a 'File not Found.'. Try uploading a file and see if you can access the file. If you can, congratulations!

### Service

Now that you know that the file server is running correctly, you can create a service to ensure that the server runs on startup.

Run `touch /etc/systemd/system/files.service` then insert the following into the service:

```
[Unit]
Description=files

[Service]
ExecStart=-/usr/bin/node location/server.js
Restart=always
User=your-username
Group=your-username
Environment=PATH=/usr/bin:/usr/local/bin
Environment=NODE_ENV=production
WorkingDirectory=location/

[Install]
WantedBy=multi-user.target
```

Replacing `location/` with the location, and `your-username` with your username.

You can now run `systemctl start files` and the server should start in the background and on startup. Yay!