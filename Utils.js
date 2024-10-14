//import { exec } from 'child_process';

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
        const safePath = contextPath.replace(/ /g, '\\ ');
        exec(`docker build -t ${imageName} ${safePath}`, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error building Docker image: ${stderr}`);
                return reject(error);
            }
            console.log(`Docker image built: ${stdout}`);
            resolve(true);
        });
    });
}
