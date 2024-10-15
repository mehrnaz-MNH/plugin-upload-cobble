import express from 'express';
import fileUpload from 'express-fileupload';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import unzipper from 'unzipper';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';


const app = express();
dotenv.config();
const port = 3000;
app.use(fileUpload());
app.use(express.json());


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, 'public')));

app.post('/upload', async (req, res) => {
    if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).json({ success: false, message: 'No file uploaded' });
    }


    const file = req.files[Object.keys(req.files)[0]];

    if (!file.name.endsWith('.zip')) {
        return res.status(400).json({ success: false, message: 'File needs to be a zip' });
    }

    const pathName = uuidv4() + '_' + file.name;
    const unZipName = 'Extracted_' + pathName;
    const filePath = path.join(__dirname, 'files/uploads', pathName);
    const unZipPath = path.join(__dirname, 'files/unzipped', unZipName);


    if (!fs.existsSync(path.join(__dirname, 'files'))) {
        fs.mkdirSync(path.join(__dirname, 'files'));
    }

    if (!fs.existsSync(path.join(__dirname, 'files/uploads'))) {
        fs.mkdirSync(path.join(__dirname, 'files/uploads'));
    }

    if (!fs.existsSync(path.join(__dirname, 'files/unzipped'))) {
        fs.mkdirSync(path.join(__dirname, 'files/unzipped'));
    }

    file.mv(filePath, (err) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'File Upload Failed! Try Again' });
        }

        fs.createReadStream(filePath)
            .pipe(unzipper.Extract({ path: unZipPath }))
            .on('close', async () => {

                return res.status(200).json({ success: true, path: unZipPath, message: "Upload Successful" });

            })
            .on('error', () => {
                res
                    .status(500)
                    .json({ success: false, message: "Uploading Failed" });
            });
    });
});

app.post('/validate', async (req, res) => {

    const { dirName } = req.body
    console.log(req)
    console.log(dirName)
    if (!dirName) {
        return res.status(400).json({ success: false, message: 'failed to find Directory' })
    }

    try {

        const dockerfilePath = await findDockerfile(dirName);

        if (!dockerfilePath) {
            return res.status(400).json({ success: false, message: "No Docker file found" });
        }

        const isDockerValid = await validateDockerfile(dockerfilePath);

        if (!isDockerValid) {
            return res.status(400).json({ success: false, message: 'Dockerfile is not valid' });
        }


        return res.status(200).json({ success: true, pathName: dirName, message: "Validation Successful" });



    } catch (err) {

        res
            .status(500)
            .json({ success: false, message: "Validating Failed" });

    }

})


app.post('/build', async (req, res) => {
    const { dirName } = req.body;

    if (!dirName) {
        return res.status(400).json({ success: false, message: 'Directory name required' });
    }

    const uniqueImageName = `uploadedPlugin_${uuidv4()}`.toLowerCase();

    try {

        const dockerfilePath = await findDockerfile(dirName);

        if (!dockerfilePath) {
            return res.status(400).json({ success: false, message: "No Docker file found" });
        }

        const contextPath = path.dirname(dockerfilePath);

        await buildDockerImage(contextPath, uniqueImageName);



        return res.status(200).json({ success: true, message: "Docker image built successfully", imageName: uniqueImageName });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: "Building Docker image failed" });
    }
});



app.post('/push', async (req, res) => {
    const { imageName } = req.body;

    if (!imageName) {
        return res.status(400).json({ success: false, message: 'Image name required' });
    }


    try {

        const login = await loginToGithub();

        if (!login) {
            return res.status(400).json({ success: false, message: "Login Failed" });
        }

        const githubRepo = "mehrnaz-MNH/plugin-upload-cobble"

        await pushToGithub(imageName, githubRepo)

        return res.status(200).json({ success: true, message: "Image Pushed successfully" });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: "Failed to Push Image into Github " });
    }
})


async function findDockerfile(dir) {
    const files = fs.readdirSync(dir);
    for (let file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            const foundDockerfile = await findDockerfile(fullPath);
            if (foundDockerfile) return foundDockerfile;
        } else if (file === 'Dockerfile') {
            return fullPath;
        }
    }
    return null;
}

function validateDockerfile(dockerfilePath) {
    return new Promise((resolve, reject) => {
        const safePath = dockerfilePath.replace(/ /g, '\\ ');
        exec(`hadolint ${safePath}`, (error, stdout, stderr) => {
            if (error) {
                console.error(`Dockerfile validation failed: ${stderr}`);
                return resolve(false);
            }
            console.log(`Dockerfile valid: ${stdout}`);
            resolve(true);
        });
    });
}

function buildDockerImage(contextPath, imageName) {
    return new Promise((resolve, reject) => {
        exec(`docker build -t ${imageName}  ${contextPath}`, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error building Docker image: ${stderr}`);
                return reject(error);
            }
            console.log(`Docker image built: ${stdout}`);
            resolve(true);
        });
    });
}



function loginToGithub() {
    return new Promise((resolve, reject) => {
        const githubUsername = 'mehrnaz-MNH';
        exec(`echo "${process.env.GITHUB_TOKEN}" | docker login ghcr.io -u "${githubUsername}" --password-stdin`, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error logging in to GitHub: ${stderr}`);
                return reject(error);
            }
            console.log(`Logged in to GitHub: ${stdout}`);
            resolve(true);
        });
    });
}

function pushToGithub(imageName, githubRepo) {
    return new Promise((resolve, reject) => {
        const fullImageName = `ghcr.io/${githubRepo}/${imageName}`;
        exec(`docker tag ${imageName}  ${fullImageName}`, (error) => {
            if (error) {
                return reject(error);
            }
            exec(`docker push ${fullImageName}`, (error, stdout, stderr) => {
                if (error) {
                    console.error(`Error pushing Docker image to GitHub: ${stderr}`);
                    return reject(error);
                }
                console.log(`Docker image pushed to GitHub: ${stdout}`);
                resolve(true);
            });
        });
    });
}



app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(port, () => {
    console.log(`app listening at http://localhost:${port}`);
});
