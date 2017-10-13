import * as express from 'express'
import * as fs from 'fs'
import { Request, Response } from 'express'
import * as FileUpload from 'express-fileupload'
import * as randomstring from 'randomstring'
import * as Database from 'better-sqlite3'
import * as BodyParser from 'body-parser'

const app: express.Application = express();
const port: number = 4651;

enum ImageType
{
    Normal,
    Password_Protected
}

let db = new Database('database.db');
let begin = db.prepare('BEGIN');
let commit = db.prepare('COMMIT');
let rollback = db.prepare('ROLLBACK');

let asTransaction = (func) =>
{
    return function (...args)
    {
        begin.run();
        try
        {
            func(...args);
            commit.run();
        }
        finally
        {
            if (db.inTransaction) rollback.run();
        }
    };
}

// Accept body requests
app.use(BodyParser.urlencoded({ extended: false }));
// Accept file uploads
app.use(FileUpload());

// Ignore requests to /
app.get('/', (req: Request, res: Response) => {
    res.status(404).send("File not found.");
});

// Handle uploads to the server.
app.post('/upload', (req: Request, res: Response) =>
{
    // Check for a valid auth token.
    let token = req.body.auth;
    let row = db.prepare('SELECT * FROM auth_tokens WHERE token=?').get(token);

    if (row == undefined)
    {
        return res.status(401).send("Invalid token.");
    }

    // Ensure a file is being uploaded.
    if (!req.files)
    {
        return res.status(400).send('No files were uploaded.' + req.files);
    }

    // Strip metadata from file.
    let file = req.files.upload;
    let filename = file.name;
    let extension = filename.split('.').slice(1).join('.');
    let mime = file.mimetype;
    let uploadName = randomstring.generate(10);
    let deletionToken = randomstring.generate(10);
    let type: ImageType = ImageType.Normal;

    // Set the image to a password protected image if requested.
    if (req.body.protected != undefined)
    {
        type = ImageType.Password_Protected;
    }

    // Insert metadata into database.
    asTransaction(function()
    {
        db.prepare('INSERT INTO images (token, extension, filename, mime, deletion_token, access_type) VALUES (?, ?, ?, ?, ?, ?)')
              .run(uploadName, extension, filename, mime, deletionToken, type);
    })();

    // Upload file to server
    file.mv('./uploads/' + uploadName + "." + extension, function(err)
    {
        if (err)
        {
            return res.status(500).send(err);
        }

        // Return filepath along with deletion token.
        let obj = {
            file: uploadName + "." + extension,
            deletion: deletionToken
        };
        res.status(200).send(JSON.stringify(obj));
    });
});

// Handle deletion requests
app.get('/delete/:token', (req: Request, res: Response) => {
    // Check for a valid deletion token. This token is generated per image upload.
    let { token } = req.params;
    let row = db.prepare('SELECT * FROM images WHERE deletion_token=?').get(token);

    if (row == undefined)
    {
        return res.status(401).send("Invalid deletion token.");
    }

    // Delete image from database.
    asTransaction(function()
    {
        db.prepare('DELETE FROM images WHERE deletion_token=?').run(token);
    })();

    // Delete file from server
    fs.unlink("./uploads/" + row.token + "." + row.extension, function (err)
    {
        if (err)
        {
            return res.status(500).send(err);
        }
    });

    return res.send("Deleted file.");
});

// Handle set password request. This is triggered on the first time a password
// protected image is accessed.
app.post("/set-password/:token", (req: Request, res: Response) => {
    // Find an image with the requested filename
    let { token } = req.params;
    let password = req.body.password;
    let row = db.prepare('SELECT * FROM images WHERE token=?').get(token);

    // If the file isn't password protected or has already been password protected
    // this is an invalid request.
    if (row == undefined || row.access_token != null || row.access_type != ImageType.Password_Protected)
    {
        return res.status(400).send("Invalid token request.");
    }

    // Set the password for the image.
    asTransaction(function()
    {
        db.prepare('UPDATE images SET access_token=? WHERE token=?').run(password, token);
    })();

    return res.redirect("/" + token);
});

// Handle image requests
app.all('/:request', (req: Request, res: Response) => {
    let { request } = req.params;
    let query = req.query;

    // Try and find the extension within the URL
    let extension = request.split('.').slice(1).join('.');

    if (extension.length > 0)
    {
        extension = "." + extension;
    }

    // If we find an extension, remove it from the request
    let token = request.substr(0, request.length - extension.length);
    // Find an image with the token within the URL.
    let row = db.prepare('SELECT * FROM images WHERE token=?').get(token);

    if (row == undefined)
    {
        return res.status(404).send("File not found.");
    }

    // Handle password protected files.
    if (row.access_type == ImageType.Password_Protected)
    {
        // If the file doesn't have a password set, we show the password
        // set form to let the user set a password before sending the URL
        // to other users.
        if (row.access_token == null)
        {
            return res.send(
`<!DOCTYPE HTML>
<body>
    <form action="/set-password/${row.token}" method="post">
        Set access password
        <input type="text" name="password"/>
        <input type="submit" value="Submit">
    </form>
</body>`
            );
        }
        else
        {
            // Attempt to find the password within the request.
            let password = req.body.password;

            // If the password is not valid or hasn't been sent,
            // we show the password prompt to the user.
            if (password != row.access_token)
            {
                return res.send(
`<!DOCTYPE HTML>
<head>
    <style>
        html, body, form { height: 100%; overflow: hidden; }
        form { display: flex; flex-direction: column; justify-content: center; align-items: center;}
        input { border: 1px solid #e6e6e6; padding: 10px 15px; width: 300px; color: #545454; }
    </style>
</head>
<body>
    <form action="/${row.token}" method="post">
        <input type="password" name="password" placeholder="password"/>
    </form>
</body>`
                );
            }
        }
    }

    let options = {
        root: "./uploads",
        dotfiles: 'deny'
    };

    // Send the file to the user.
    let filename = row.token + "." + row.extension;
    res.sendFile(filename, options, function (err)
    {
        if (err)
        {
            console.log(err);
        }
    });
});

app.listen(port, () => {
    console.log("Server started.")
});