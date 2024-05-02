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

const consoleLogStats = (filePath, optimizedFile, optimizedFilePath) => {
  try {
    const oldStatsKb = fs.statSync(filePath).size / 1024;
    const newStatsKb = fs.statSync(optimizedFilePath).size / 1024;
    let reductionPercent;
    if (oldStatsKb === 0) reductionPercent = 100;
    else reductionPercent = (1 - newStatsKb / oldStatsKb) * 100;

    console.log(
      `🟢 (-${reductionPercent.toFixed(1)}%) ${oldStatsKb.toFixed(
        1
      )} Kb → ${newStatsKb.toFixed(1)} Kb : ${optimizedFile} `
    );
  } catch {
    console.log("🔴 Error: Can't display the results");
  }
};

fs.readdir(directoryPath, async (err, files) => {
  if (err) {
    console.error(`Couldn't read the directory ${directoryPath}`);
    console.error(err);
    return;
  }

  console.log(directoryPath);
  console.log(files);

  for (const file of files) {
    const filePath = path.join(directoryPath, file);
    const fileExtension = path.extname(file).toLowerCase();
    const optimizedFile = "OPT-" + file;
    const optimizedFilePath = path.join(directoryPath, optimizedFile);

    console.log(file, filePath, optimizedFile);

    if (fileExtension === ".jpg" || fileExtension === ".jpeg") {
      try {
        const data = await sharp(filePath).jpeg({ quality: 75 }).toBuffer();
        await fs.promises.writeFile(optimizedFilePath, data);
        // consoleLogStats(filePath, optimizedFile, optimizedFilePath);
      } catch (err) {
        console.error(`🔴 Error processing file: ${file}`, err);
      }
    } else if (fileExtension === ".png") {
      try {
        const data = await sharp(filePath)
          .png({ compressionLevel: 6 })
          .toBuffer();
        await fs.promises.writeFile(filePath, data);

        console.log(filePath);
        // consoleLogStats(filePath, optimizedFile, optimizedFilePath);
      } catch (err) {
        console.error(`🔴 Error processing file: ${file}`, err);
      }
    } else if (fileExtension === ".mp4") {
      try {
        await new Promise((resolve, reject) => {
          ffmpeg(filePath)
            .outputOptions(["-codec:v libx264", "-crf 28", "-preset slow"])
            .on("error", (err) => {
              console.error(`🔴 Error processing file: ${file}`, err);
              reject(err);
            })
            .save(optimizedFilePath);
        });
        console.log(filePath);
        // consoleLogStats(filePath, optimizedFile, optimizedFilePath);
      } catch (err) {
        console.error(`Error processing video file: ${file}`, err);
      }
    } else
      console.log(
        `⚪️ Skipped ${file} ⚠️ Support only .png, .jpg, .jpeg, .mp4`
      );
  }
  console.log("Job's done.");
});
