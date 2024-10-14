const uploadForm = document.getElementById("uploadForm");
const fileInput = document.getElementById("fileInput");
const optionsDiv = document.getElementById("options");
const resultDiv = document.getElementById("result");
const validateBtn = document.getElementById("validation");
const buildBtn = document.getElementById("building");
const pushBtn = document.getElementById("pushing");

let dirPath = "";
let dockerPath = "";

uploadForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const file = fileInput.files[0];
    if (!file) {
        alert("Please choose a file.");
        return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
        resultDiv.style.display = "none";

        const response = await fetch("/upload", {
            method: "POST",
            body: formData,
        });

        const result = await response.json();

        resultDiv.style.display = "block";

        if (response.ok) {
            resultDiv.classList.add("success");
            resultDiv.classList.remove("error");
            resultDiv.textContent =
                "Success: " + result.message || "File Uploaded!";
            optionsDiv.style.display = "block";
            dirPath = result.path;
            console.log(dirPath);
        } else {
            resultDiv.classList.add("error");
            resultDiv.classList.remove("success");
            resultDiv.textContent = "Error: " + result.message;
        }
    } catch (error) {
        resultDiv.classList.add("error");
        resultDiv.classList.remove("success");
        resultDiv.style.display = "block";
        resultDiv.textContent = "Error uploading file: " + error.message;
    }
});

validateBtn.addEventListener("click", async () => {
    try {
        resultDiv.style.display = "none";

        const response = await fetch("/validate", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ dirName: dirPath }),
        });

        const result = await response.json();

        resultDiv.style.display = "block";

        if (response.ok) {
            resultDiv.classList.add("success");
            resultDiv.classList.remove("error");
            resultDiv.textContent =
                "Success: " + result.message ||
                "Docker image Validated successfully!";
            dockerPath = result.dockerPath;
            console.log(dockerPath);
            buildBtn.style.display = "block";
        } else {
            resultDiv.classList.add("error");
            resultDiv.classList.remove("success");
            resultDiv.textContent = "Error: " + result.message;
        }
    } catch (error) {
        resultDiv.classList.add("error");
        resultDiv.classList.remove("success");
        resultDiv.style.display = "block";
        resultDiv.textContent = "Error validating docker: " + error.message;
    }
});

buildBtn.addEventListener("click", async () => {
    try {
        resultDiv.style.display = "none";

        const response = await fetch("/build", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ dockerfilePath: dockerPath }),
        });

        const result = await response.json();

        resultDiv.style.display = "block";

        if (response.ok) {
            resultDiv.classList.add("success");
            resultDiv.classList.remove("error");
            resultDiv.textContent =
                "Success: " + result.message ||
                "Docker image build successfully!";
            pushBtn.style.display = "block";
        } else {
            resultDiv.classList.add("error");
            resultDiv.classList.remove("success");
            resultDiv.textContent = "Error: " + result.message;
        }
    } catch (error) {
        resultDiv.classList.add("error");
        resultDiv.classList.remove("success");
        resultDiv.style.display = "block";
        resultDiv.textContent = "Error building image: " + error.message;
    }
});
