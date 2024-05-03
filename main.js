require("dotenv").config();
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const ffmpeg = require("fluent-ffmpeg");

const firstArg = process.argv[2];
if (firstArg === undefined)
  console.log(
    "Command line argument wasn't specified, trying to optimize the contents of the default folder (the default path is defined in .env file):",
    process.env.DEFAULT_PATH
  );
const directoryPath = firstArg ?? process.env.DEFAULT_PATH;

function formatDate() {
  const date = new Date();
  const pad = (num) => num.toString().padStart(2, "0");

  const day = pad(date.getDate());
  const month = pad(date.getMonth() + 1); // January is 0!
  const year = date.getFullYear();
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());

  return `${day}_${month}_${year} ${hours}_${minutes}_${seconds}`;
}

const resultsFolderName = `results ${formatDate()}`;
const resultsFolderPath = path.join(directoryPath, resultsFolderName);

try {
  if (!fs.existsSync(resultsFolderPath)) {
    fs.mkdirSync(resultsFolderPath);
  }
} catch (err) {
  console.error(err);
  return;
}

const consoleLogStats = async (file, filePath, optimizedFilePath) => {
  try {
    const oldStatsKb = fs.statSync(filePath).size / 1024;

    // Without that time there might be errors with reading the stats of the newly created file
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const newStatsKb = fs.statSync(optimizedFilePath).size / 1024;
    let reductionPercent;
    if (oldStatsKb === 0) reductionPercent = 100;
    else
      reductionPercent = `- ${((1 - newStatsKb / oldStatsKb) * 100).toFixed(
        1
      )}%`.padEnd(7, " ");

    console.log(
      `🟢 [${reductionPercent}] | ${oldStatsKb.toFixed(
        1
      )} kB → ${newStatsKb.toFixed(1)} kB | ${file} `
    );
  } catch (err) {
    console.log(
      `🔴 Error: Can't display the results for ${file}. Reason: ${err.message}`
    );
  }
};

fs.readdir(directoryPath, (err, files) => {
  if (err) {
    console.error(`Couldn't read the directory ${directoryPath}`);
    console.error(err);
    return;
  }

  console.log("--------------");
  console.log("Input path:   ", directoryPath);
  console.log("Results path: ", resultsFolderPath);
  console.log("--------------");

  for (const file of files) {
    const filePath = path.join(directoryPath, file);
    const fileExtension = path.extname(file).toLowerCase();
    const optimizedFile = "OPT-" + file; // I might like to change the name in the future (or not)
    const optimizedFilePath = path.join(
      directoryPath,
      resultsFolderName,
      optimizedFile
    );

    try {
      if (fileExtension === ".jpg" || fileExtension === ".jpeg") {
        (async function () {
          const data = await sharp(filePath).jpeg({ quality: 75 }).toBuffer();
          fs.writeFileSync(optimizedFilePath, data);
        })();
        consoleLogStats(file, filePath, optimizedFilePath);
        continue;
      }
      if (fileExtension === ".png") {
        (async function () {
          const data = await sharp(filePath)
            .png({ compressionLevel: 6 })
            .toBuffer();
          fs.writeFileSync(optimizedFilePath, data);
        })();
        consoleLogStats(file, filePath, optimizedFilePath);
        continue;
      }
      if (fileExtension === ".mp4") {
        (async function () {
          await new Promise((resolve, reject) => {
            ffmpeg(filePath)
              .outputOptions(["-codec:v libx264", "-crf 28", "-preset slow"])
              .on("error", (err) => {
                console.error(`🔴 Error processing file: ${file}`, err);
                reject(err);
              })
              .save(optimizedFilePath);
          });
        })();
        consoleLogStats(file, filePath, optimizedFilePath);
        continue;
      }
      if (fileExtension === "") continue;
      console.log(
        `⚪️ Skipped ${file} ⚠️ Support only .png, .jpg, .jpeg, .mp4`
      );
    } catch (err) {
      console.error(`🔴 Error processing file: ${file}`, err);
    }
  }
});
