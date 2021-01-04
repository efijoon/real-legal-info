const puppeteer = require("puppeteer");
const express = require("express");
const bodyParser = require("body-parser");
const getDataDate = require("./getData/date/getDataDate");
const mongoose = require("mongoose");
const Namad = require("./Namad");
const getFirstHalfNamadId = require("./getFirstHalfNamadID");
const getSecondHalfNamadId = require("./getSecondHalfNamadID");
const NullNamad = require("./NullNamad");
const Failed = require("./failed");

const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// ====================  Haghighi section ============================ //
const getRealBuyAmounts = require("./getData/real/getRealBuyAmounts");
const getRealBuyCounts = require("./getData/real/getRealBuyCounts");
const getRealSellAmounts = require("./getData/real/getRealSellAmounts");
const getRealSellCounts = require("./getData/real/getRealSellCounts");
// ====================  Haghighi section ============================ //

// ====================  Hoghoghi section ============================ //
const getLegalBuyAmounts = require("./getData/legal/getLegalBuyAmounts");
const getLegalBuyCounts = require("./getData/legal/getLegalBuyCounts");
const getLegalSellCounts = require("./getData/legal/getLegalSellCounts");
const getLegalSellAmounts = require("./getData/legal/getLegalSellAmounts");
// ====================  Hoghoghi section ============================ //

mongoose.connect("url", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true,
});

app.get("/", (req, res) => {
  res.send("Its an application (its the second part) ...");
});

app.post("/getData", async (req, res) => {
  const { id } = req.body;

  const namad = await Namad.findOne({ id });

  if (namad == null)
    return res.status(404).send("No Data Founded ! Please enter a valid id.");

  return res.status(200).send(namad.dataToRespond);
});

(async () => {
  let iterator = 0;

  const browserPartOne = await puppeteer.launch({
    headless: true,
    waitUntil: "networkidle2",
    args: ["--no-sandbox"],
  });
  let firstHalfdata = getFirstHalfNamadId();

  const browserPartTwo = await puppeteer.launch({
    headless: true,
    waitUntil: "networkidle2",
    args: ["--no-sandbox"],
  });
  let secondHalfdata = getSecondHalfNamadId();

  // Set the inner loop for getting symbols data
  setInterval(() => {
    getData(browserPartOne, firstHalfdata);
    getData(browserPartTwo, secondHalfdata);
  }, 8000);

  async function getData(browser, data) {
    iterator++;

    if (iterator == data.length - 1) {
      iterator = 0;
      console.log("One Complete Scrape ...");
      await browser.close();
    }

    const page = await browser.newPage();
    try {
      await page.goto(
        `http://www.tsetmc.com/loader.aspx?ParTree=151311&i=${data[iterator][0]}`
      );

      await page.waitForTimeout(3000);
      // ================= we now enter to the namad page ============================= //
      await page.evaluate(async () => {
        let dataTab = document.getElementsByClassName("violet");
        await dataTab[0].click();
      });

      let realBuyAmounts = [];
      let realBuyCounts = [];
      let realSellAmounts = [];
      let realSellCounts = [];
      let legalBuyAmounts = [];
      let legalBuyCounts = [];
      let legalSellAmounts = [];
      let legalSellCounts = [];
      let fail = false;

      await page.waitForTimeout(4000);

      try {
        realBuyAmounts = await getRealBuyAmounts(page);
        realBuyCounts = await getRealBuyCounts(page);
        realSellAmounts = await getRealSellAmounts(page);
        realSellCounts = await getRealSellCounts(page);

        legalBuyAmounts = await getLegalBuyAmounts(page);
        legalBuyCounts = await getLegalBuyCounts(page);
        legalSellAmounts = await getLegalSellAmounts(page);
        legalSellCounts = await getLegalSellCounts(page);
      } catch (ex) {
        console.log("Null Data: " + data[iterator][0]);

        const newNullNamad = new NullNamad({
          id: data[iterator][0],
        });
        await newNullNamad.save();

        fail = true;
      }

      if (fail) {
        // The namd has no real and legal info ...
        await saveDataInDB(data[iterator][0], null);
        iterator++;
        return page.close();
      }

      const dates = await getDataDate(page);

      let obj = {};
      let dataToRespond = [];
      let realbuyPower;
      let realSellPower;
      let legalBuyPower;
      let legalSellPower;

      // ==== Loops throw Haghighi data and make their powers ======= //
      for (let i = 0; i < realBuyAmounts.length; i++) {
        realbuyPower =
          parseInt(numberWithOutCommas(realBuyAmounts[i])) /
          parseInt(numberWithOutCommas(realBuyCounts[i]));

        realSellPower =
          parseInt(numberWithOutCommas(realSellAmounts[i])) /
          parseInt(numberWithOutCommas(realSellCounts[i]));

        legalBuyPower =
          parseInt(numberWithOutCommas(legalBuyAmounts[i])) /
          parseInt(numberWithOutCommas(legalBuyCounts[i]));

        legalSellPower =
          parseInt(numberWithOutCommas(legalSellAmounts[i])) /
          parseInt(numberWithOutCommas(legalSellCounts[i]));

        obj = {
          number: i + 1,
          date: `${dates[i].day} ${dates[i].month}`,
          realBuyerToSellerPower:
            realbuyPower / realSellPower
              ? (realbuyPower / realSellPower).toFixed(2)
              : null,
          legalBuyerToSellerPower:
            legalBuyPower / legalSellPower
              ? (legalBuyPower / legalSellPower).toFixed(2)
              : null,
          realbuyPower: Math.round(realbuyPower),
          realSellPower: Math.round(realSellPower),
          legalBuyPower: Math.round(legalBuyPower),
          legalSellPower: Math.round(legalSellPower),
        };

        dataToRespond.push(obj);
      }

      await saveDataInDB(data[iterator][0], dataToRespond);

      await page.close();
    } catch (e) {
      if (e instanceof puppeteer.errors.TimeoutError) {
        console.log("Failed: " + data[iterator][0]);

        const newFailed = new Failed({
          id: data[iterator][0],
        });
        await newFailed.save();

        await page.close();
      }
    }
  }
})();

async function saveDataInDB(id, dataToRespond) {
  const namad = await Namad.findOne({ id });
  if (namad == null) {
    const newNamad = new Namad({
      id,
      dataToRespond,
    });
    await newNamad.save();
  } else {
    await Namad.updateOne({ id }, { dataToRespond });
  }
}

function numberWithOutCommas(number) {
  return number.toString().replace(/,/g, "");
}

app.listen(process.env.PORT || 5000, () => {
  console.log("Server is running on port 5000");
});
