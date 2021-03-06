RSC = {}; // namespace for Retirement Spending Calculator
RSC.data = {}; // dictionary for life expectancy tables
RSC.addr = "http://localhost:8000/index.html";

// Load the life expectancy tables
let csvFilesToParse = 4
let csvFilesParsed = 0
let onCsvParseComplete = function(results, file) {
    console.log("Parsing complete:", results, file);

    RSC.data[file] = results.data
    csvFilesParsed += 1
}

Papa.parse(
    "male-median.csv",
    {
        download: true,
        header: true,
        complete: onCsvParseComplete
    }
)
Papa.parse(
    "male-high-longevity.csv",
    {
        download: true,
        header: true,
        complete: onCsvParseComplete
    }
)
Papa.parse(
    "female-median.csv",
    {
        download: true,
        header: true,
        complete: onCsvParseComplete
    }
)
Papa.parse(
    "female-high-longevity.csv",
    {
        download: true,
        header: true,
        complete: onCsvParseComplete
    }
)

let lookupLifeExpectancy = function(sex, longevity, yearOfBirth, age) {
    // Sanity check parameters
    if (sex != "male" && sex != "female") {
        throw "Sex must be either 'male' or 'female'";
    }
    if (longevity != "median" && longevity != "high-longevity") {
        throw "Longevity must be either 'median' or 'high-longevity'";
    }
    if (isNaN(yearOfBirth)) {
        throw "Year of birth must be a year between 1876 and 2016";
    }
    if (yearOfBirth < 1876) {
        throw "Year of birth must be no earlier than 1876";
    }
    if (yearOfBirth > 2016) {
        throw "Year of birth must be no later than 2016";
    }
    if (isNaN(age)) {
        throw "Age must be a number between 0 and 95 (inclusive)";
    }
    if (age < 0) {
        throw "Age must be positive";
    }
    if (age > 95) {
        throw "Age must be no greater than 95";
    }
    
    // Get appropriate CSV filename
    filename = sex + "-" + longevity + ".csv";
    
    // Get life-expectancy for floored years
    let initialYear = RSC.data[filename][0].year;
    let index = yearOfBirth - initialYear;
    let row = RSC.data[filename][index];
    console.assert(row !== undefined, "Row is undefined");
    console.assert(row.year == yearOfBirth, "Error detected with row lookup for life expectancy");

    if (age < 0) return null;
    if (age > 95) return null;

    let str = RSC.data[filename][index][parseInt(age)];
    return parseFloat(str);
}

let calcLifeExpectancy = function(sex, longevity, dob, age) {
    // Get year of birth
    yearOfBirth = dob.getFullYear();

    // Lookup life expectancy for floored age
    let flooredAge = Math.floor(age);
    let flooredExpected = lookupLifeExpectancy(sex, longevity, yearOfBirth, flooredAge);

    // Lookup life expectancy for ceiling age
    let ceilAge = Math.ceil(age);
    let ceilExpected = lookupLifeExpectancy(sex, longevity, yearOfBirth, ceilAge);

    // Calculate weighted average
    let weight = age - flooredAge;
    console.assert(weight >= 0, "Expected weight to be non-negative");
    console.assert(weight <= 1, "Expected weight to be below one");
    let avgExpected = (1-weight)*flooredExpected + weight*ceilExpected;
    
    return avgExpected;
}

document.getElementById("retirementDateToday").onclick= function() {
    let retirementDate = document.forms.details.elements.retirementDate.valueAsDate = new Date();
}

// Get the values from the form's fields
let getValuesFromForm = function() {
    let sex = document.forms.details.sex.value;
    let longevity = document.forms.details.longevity.value;
    let additionalLongevity = document.forms.details.additionalLongevity.valueAsNumber;
    let dob = document.forms.details.dob.value;
    dob = new Date(document.forms.details.dob.valueAsNumber);
    let retirementDate = document.forms.details.retirementDate.value;
    retirementDate = new Date(document.forms.details.retirementDate.valueAsNumber);
    let startingAmount = parseFloat(document.forms.details.startingAmount.value);
    let superannuation = parseFloat(document.forms.details.superannuation.value);
    let interestRate = parseFloat(document.forms.details.interestRate.value) / 100;
    
    return {
        sex: sex,
        dob: dob,
        longevity: longevity,
        additionalLongevity: additionalLongevity,
        retirementDate: retirementDate,
        startingAmount: startingAmount,
        superannuation: superannuation,
        interestRate: interestRate
    };
}

// Return the age as number of years and number of days 
calcAge = function(date, dob) {
    // Check that date is after dob
    if (dob > date) {
        throw "Date occurs before date-of-birth";
    }
    
    // Calculate number of years and days between the two dates.
    let years = date.getFullYear() - dob.getFullYear() -1
    let days = 0
    if (date.getMonth() >= dob.getMonth()
        && date.getDate() >= dob.getDate()) {
        years += 1;
        days = (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
                - Date.UTC(date.getFullYear(), dob.getMonth(), dob.getDate())) / 24 / 60 / 60 / 1000;
    } else {
        days = (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
                - Date.UTC(date.getFullYear()-1, dob.getMonth(), dob.getDate())) / 24 / 60 / 60 / 1000;
    }

    // Calculate number of days between last birthday and the next
    let daysInYear = (Date.UTC(date.getFullYear()+1, dob.getMonth(), dob.getDate())
                      - Date.UTC(date.getFullYear(), dob.getMonth(), dob.getDate())) / 24 / 60 / 60 / 1000;
    let value = years + (days/daysInYear);

    return {
        years: years,
        days: days,
        value: value
    };
};

let getDateString = function(date) {
    if (date === undefined) return "undefined";
    return (+date.getFullYear().toString()
            +"-"
            +(date.getMonth()+1).toString().padStart(2,"0")
            +"-"
            +date.getDate().toString().padStart(2,"0"));
}

let generateChart = function(points) {
    let width=750;
    let height=375;
    
    let margin = ({top: 25*1.5, right: 30*1.5, bottom: 30*1.5, left: 40*1.5});
    
    let x = d3.scaleLinear()
        .domain(d3.extent(points, p => p.x))
        .range([margin.left, width - margin.right])

    let y = d3.scaleLinear()
        .domain([0, d3.max(points, p => p.y)]).nice()
        .range([height - margin.bottom, margin.top])
    
    let xAxis = g => g
        .attr("transform", `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(x).ticks(width / (80*1.5)).tickSizeOuter(0))
        .call(g => g.append("text")
              .attr("x", (width-margin.left-margin.right)/2+margin.left)
              .attr("y", margin.bottom - 8)
              .attr("fill", "currentColor")
              .attr("text-anchor", "middle")
              .text("Age (years)")
             )

    let yAxis = g => g
        .attr("transform", `translate(${margin.left},0)`)
        .call(d3.axisLeft(y))
        .call(g => g.select(".domain").remove())
        .call(g => g.select(".tick:last-of-type text").clone()
              .attr("x", 3)
              .attr("text-anchor", "start")
              .attr("font-weight", "bold")
              .text(points.y))
        .call(g => g.append("text")
              .attr("x", -margin.left)
              .attr("y", 20)
              .attr("fill", "currentColor")
              .attr("text-anchor", "start")
              .text("Budget per Week ($)")
             )

    let grid = g => g
        .attr("stroke", "currentColor")
        .attr("stroke-opacity", 0.05)
        .call(g => g.append("g")
              .selectAll("line")
              .data(x.ticks())
              .join("line")
              .attr("x1", d => 0.5 + x(d))
              .attr("x2", d => 0.5 + x(d))
              .attr("y1", margin.top)
              .attr("y2", height - margin.bottom))
        .call(g => g.append("g")
              .selectAll("line")
              .data(y.ticks())
              .join("line")
              .attr("y1", d => 0.5 + y(d))
              .attr("y2", d => 0.5 + y(d))
              .attr("x1", margin.left)
              .attr("x2", width - margin.right));

    let line = d3.line()
        .defined(p => !isNaN(p.y))
        .x(p => x(p.x))
        .y(p => y(p.y))
    
    let svg = d3.select("#chart")
        .append("svg")
        .attr("viewBox", [0, 0, width, height]);

    svg.append("g")
        .call(xAxis);

    svg.append("g")
        .call(yAxis);

    svg.append("g")
        .call(grid);

    svg.append("path")
      .datum(points)
      .attr("fill", "none")
      .attr("stroke", "steelblue")
      .attr("stroke-width", 1.5)
      .attr("stroke-linejoin", "round")
      .attr("stroke-linecap", "round")
      .attr("d", line);
}

document.getElementById("calcRetirementSpendingPlan").onclick = function() {
    values = getValuesFromForm();
    console.log("values:", values);

    let assets = values.startingAmount;
    let getNextBudgetUpdateDate = function(date, frequency) {
        if (frequency == "annual") {
            date.setFullYear(date.getFullYear() + 1);
            return date;
        }
        return undefined;
    }
    let nextBudgetUpdateDate = new Date(values.retirementDate);
    let spendPerDay = undefined;
    let drawDownPerDay = undefined;
    let interestRatePerDay = (1+values.interestRate)**(1/365)-1

    let drawdown = undefined;
    let interest = undefined;
    
    let plan = [];
    RSC.plan = plan;

    // Date
    let date = new Date(values.retirementDate);
    let maxDate = new Date(values.dob.getFullYear()+95,
                           values.dob.getMonth(),
                           values.dob.getDate());

    console.log("STARTING LOOP");
    let row = null;
    while (date <= maxDate) {
        // Calculate budget update if required
        if (date >= nextBudgetUpdateDate) {
            // If there's a current row, finish it off before
            // moving on to a new budget
            if (row !== null) {
                row.interest = interest
                row.drawdown = drawdown;
                row.endingAssets = assets;
                plan.push(row);
            } else {
                // Create an empty row
                row = {};
            }
            
            // Age 
            let age = calcAge(date, values.dob);
            let ageText = age.years + " years";
            if (age.days != 0) { ageText += " " + age.days + " days"; }

            // Life Expectancy
            let lifeExpectancy = calcLifeExpectancy(
                values.sex,
                values.longevity,
                values.dob,
                age.value
            );

            // Years remaining
            let yearsRemaining = lifeExpectancy - age.value;

            // Calculate budget
            const daysPerYear = 365.25;
            let daysRemaining = (yearsRemaining+values.additionalLongevity)*daysPerYear;
            drawDownPerDay = assets / daysRemaining;
            let superannuationPerDay = values.superannuation / daysPerYear;
            spendPerDay = drawDownPerDay + superannuationPerDay;
            
            // Store row
            row = {
                date: getDateString(date),
                ageText: ageText,
                ageValue: age.value,
                lifeExpectancy: lifeExpectancy,
                yearsRemaining: yearsRemaining,
                startingAssets: assets,
                spendPerDay: spendPerDay,
                spendPerWeek: spendPerDay*7
            };

            // Reset values for this budget
            interest = 0;
            drawdown = 0;

            // Set date for next budget update
            nextBudgetUpdateDate = getNextBudgetUpdateDate(nextBudgetUpdateDate, "annual");
        }

        // Drawdown
        drawdown += drawDownPerDay;
        assets -= drawDownPerDay;
        if (assets < 0) break;
        
        // Interest
        let interestToday = assets * interestRatePerDay;
        interest += interestToday;
        assets += interestToday;

        // Increment the date by a day
        date.setDate(date.getDate() + 1);
    }

    if (row !== null) {
        // Finish off the last row
        row.interest = interest
        row.drawdown = drawdown;
        row.endingAssets = assets;
        plan.push(row);
    }

    console.log("RSC.plan:", RSC.plan);

    // Remove previous summary
    let summaryDiv = document.getElementById("summary");
    summaryDiv.textContent = "";

    // Add summary
    
    
    // Remove previous results
    let resultsDiv = document.getElementById("results");
    resultsDiv.textContent = "";

    // Add results
    let paragraph = document.createElement("p");
    resultsDiv.appendChild(paragraph);
    firstLine = RSC.plan[0];
    paragraph.innerHTML = "The first line of the following table can be understood as follows: "+
        "At <strong>"+firstLine.date+"</strong> our retiree will be <strong>"+firstLine.ageText+" old</strong>; "+
        "they should expect to live to <strong>"+firstLine.lifeExpectancy.toFixed(1)+" years old</strong> and thus have "+
        "an expected <strong>"+firstLine.yearsRemaining+" years remaining</strong>; they begin retirement with "+
        "<strong>$"+firstLine.startingAssets+"</strong>; a daily draw down is calculated by dividing this amount by "+
        "their number of years remaining plus the specified additional years of longevity and assuming there are 365.25 days "+
        "per year; superannuation (if any was specifed) is added to the daily draw down to give a spend per week of <strong>$"+
        firstLine.spendPerWeek.toFixed(2)+"</strong>; the "+
        "daily draw down is accumulated for one year giving a total draw down of <strong>$"+firstLine.drawdown.toFixed(0)+
        "</strong>; at the same time interest is calculated and paid daily on the unspent assets, the accumulated total of "+
        "interest is <strong>$"+firstLine.interest.toFixed(0)+"</strong> (after fees, taxes, and inflation).  The starting "+
        "assets less the draw down but plus "+
        "interest is the value used for the starting assets of the next year.  The process is repeated until the retiree has "+
        "negative assets or reaches 95 years old.  Each line of the table represents a year of retirement.";
    
    let table = document.createElement("table");
    table.setAttribute("class","table");
    resultsDiv.appendChild(table);
    let tableHeader = document.createElement("thead");
    table.appendChild(tableHeader);
    let tableHeaderRow = document.createElement("tr");
    tableHeader.appendChild(tableHeaderRow);
    let colNames = ["Date",
                    "Age",
                    "Life Expectancy",
                    "Years Remaining",
                    "Starting Assets ($)",
                    "Spend per Week",
                    "Draw Down",
                    "Interest"];
    colNames.forEach(colName => {
        let col = document.createElement("th");
        col.textContent = colName;
        tableHeaderRow.appendChild(col);
    });
    let tableBody = document.createElement("tbody");
    table.appendChild(tableBody);
    RSC.plan.forEach(row => {
        let tableBodyRow = document.createElement("tr");
        tableBody.appendChild(tableBodyRow);
        let colIds = ["date",
                      "ageValue",
                      "lifeExpectancy",
                      "yearsRemaining",
                      "startingAssets",
                      "spendPerWeek",
                      "drawdown",
                      "interest"];
        let dps = [null,1,1,1,0,0,0,0];
        colIds.forEach((colId,index) => {
            let cell = document.createElement("td");
            let value = row[colId];
            if (typeof(value)=="number") { value = value.toFixed(dps[index]); }
            cell.textContent = value;
            tableBodyRow.appendChild(cell);
        });
        
    });
    
    // Remove the old QR code if there is one
    document.getElementById("qr-code").textContent = "";
    
    // Add QR code and link
    let addr = RSC.addr;
    addr += "?s=" + (values.sex=="male"?"m":"f");
    addr += "&b=" + getDateString(values.dob);
    addr += "&l=" + (values.longevity=="median"?"m":"l")
    addr += "&a=" + values.additionalLongevity;
    addr += "&d=" + getDateString(values.retirementDate);
    addr += "&x=" + values.startingAmount;
    addr += "&y=" + values.superannuation;
    addr += "&i=" + values.interestRate;
    document.getElementById("link").innerHTML =
        "<p>The QR code below is a <a href='"+addr+"'>personalised "+
        "link</a> to the Retirement "+
        "Spending Calculator.  It includes the data above so that "+
        "you do not have to re-enter it.</p>";
    new QRCode(document.getElementById("qr-code"), addr); 

    // Remove the previous chart
    document.getElementById("chart").textContent = "";

    // Generate a list of points for the chart
    let points = [];
    RSC.plan.forEach(row => {
        let point = {};
        point.x = row.ageValue;
        point.y = row.spendPerWeek;
        points.push(point);
    });
    console.log(points);

    // Generate chart
    generateChart(points);
    
    return false;
}

// Read the query parameters from the URL (just once, when the
// page has loaded).  Copy the values into the fields.
let params = new URLSearchParams(window.location.search.substring(1));
let sex = params.get("s");
if (sex !== null) {
    let id = (sex=="m"?"male":"female");
    document.getElementById(id).checked = true;
}

let dob = params.get("b");
if (dob !== null) document.getElementById("dob").value = dob;

let longevity = params.get("l");
if (longevity !== null) {
    let id = (longevity=="m"?"median":"high-longevity");
    document.getElementById(id).checked = true;
}

let additionalLongevity = params.get("a");
if (additionalLongevity !== null) {
    document.getElementById("additionalLongevity").value = additionalLongevity;
}

let retirementDate = params.get("d");
if (retirementDate !== null) {
    document.getElementById("retirementDate").value = retirementDate;
}

let startingAmount = params.get("x");
if (startingAmount !== null) {
    document.getElementById("startingAmount").value = startingAmount;
}

let superannuation = params.get("y");
if (superannuation !== null) {
    document.getElementById("superannuation").value = superannuation;
}

let interestRate = params.get("i");
if (interestRate !== null) {
    document.getElementById("interestRate").value = interestRate;
}

// For security, clear the data from the user's address
//window.history.replaceState(null, "", RSC.addr);

