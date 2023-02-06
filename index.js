import fetch from 'node-fetch';
import imgToPDF from 'image-to-pdf';
import express from 'express';
import request from 'request';
import fs from 'fs';
import path from 'path';
import cors from 'cors';


const app = express();
app.use(express.json())
app.use(cors())

const downloadImage = (url, fileName) => {
    return new Promise((resolve, reject) => {
        request.get(url)
            .on("error", (err) => {
                reject(err);
            })
            .pipe(fs.createWriteStream(fileName))
            .on("close", () => {
                resolve();
            });
    });
};

const makePDF = (images, sid) => {
    return new Promise((resolve, reject) => {
        try {
            imgToPDF(images, imgToPDF.sizes.A4)
                .pipe(fs.createWriteStream(`./pdfs/${sid}.pdf`))
            resolve()
        }
        catch (err) {
            reject(err)
        }
    })
}

//Route 1: POST making pdf from url

app.post('/', async (req, res) => {
    let success = false;
    const { url } = req.body;
    const reURL = /^https:\/\/resume[.]io\/r\/([\w]+)/;
    const isValidURL = reURL.test(url);
    //matching the url
    if (!isValidURL) {
        res.status(400).json({ success, "msg": "The url is incorrect" })
    }
    else {
        try {
            const sid = url.split('/r/')[1];
            //getting the meta data
            const response = await fetch(`https://ssr.resume.tools/meta/ssid-${sid}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
            });
            const json = await response.json();
            let pages = json.pages.length;
            let images = [];
            // Download the images and wait for all promises to resolve
            const downloadPromises = [];
            for (let i = 1; i <= pages; i++) {
                const fileName = `./images/${sid}-${i}.png`;
                const url = `https://ssr.resume.tools/to-image/ssid-${sid}-${i}.png?size=2000`;
                downloadPromises.push(downloadImage(url, fileName));
                images.push(fileName);
            }
            await Promise.all(downloadPromises);

            // Combine the images into a PDF and delete the images afterwards

            makePDF(images, sid).then(() => {
                images.forEach(imagePath => {
                    fs.unlink(imagePath, (err) => {
                        if (err) {
                            console.error(err);
                        } else {
                            console.log(`Deleted ${imagePath}`);
                        }
                    });
                });
                success = true;
                res.status(200).json({ success, "msg": "pdf generated" })
            }).catch((err) => {
                console.log(err)
                res.status(400).json({ success, "msg": "Some error occured" })
            })

        }
        catch (err) {
            console.log(err)
            res.status(400).json({ success, "msg": "Some error occured" })
        }
    }
})


//Route 2 GET sending pdffile to user then deleting it
app.get('/:sid', (req, res) => {
    const { sid } = req.params;
    res.setHeader('Content-disposition', `attachment; filename=${sid}.pdf`);
    res.setHeader('Content-type', 'application/pdf');
    res.sendFile(path.join(process.cwd(), `./pdfs/${sid}.pdf`), function (err) {
        if (err) {
            console.error(err);
            return res.status(500).send('Error sending the file');
        } else {
            fs.unlink(`./pdfs/${sid}.pdf`, function (err) {
                if (err) {
                    console.error(err);
                } else {
                    console.log('File deleted successfully');
                }
            });
        }
    });
})


app.listen(5000, () => {
    console.log("App Started in 5000")
})