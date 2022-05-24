google.charts.load("current");
google.charts.setOnLoadCallback(init);

function init() {
  var url =
    "https://docs.google.com/spreadsheets/d/1WDXtZu7r2bH5s6n27ydL2ULu7iUyvlPX0y1xwJufg3Q/edit#gid=0";
  var query = new google.visualization.Query(url);
  query.setQuery("select A, B, C, D");
  query.send(processSheetsData);
}

function inflationAdjustMetro(elem) {
  if (
    (elem.location === "Phoenix" && elem.date.getFullYear() >= 2018) ||
    (elem.location === "Miami" && elem.date.getFullYear() >= 2012) ||
    (elem.location === "New York" && elem.date.getFullYear() >= 2012)
  ) {
    let previousCPI =
      inflation_metro[elem.location][elem.date.getFullYear()][
        elem.date.getMonth()
      ];
    let currentCPI = inflation_metro[elem.location][2022][5];

    elem.salary_adjusted_metro = (currentCPI / previousCPI) * elem.salary;
  }
}

function inflationAdjustNational(elem) {
  if (elem.date.getFullYear() >= 2012) {
    // TODO: include all national inflation data and remove limitation
    let previousCPI =
      inflation_national[elem.date.getFullYear()][elem.date.getMonth()];
    let currentCPI = inflation_national[2022][5];

    elem.salary_adjusted_country = (currentCPI / previousCPI) * elem.salary;
  }
}

function processSheetsData(response) {
  var array = [];
  var data = response.getDataTable();
  var columns = data.getNumberOfColumns();
  var rows = data.getNumberOfRows();

  var prevElem = null; // Used to interpolate inflation-adjusted decreases over time
  for (var r = 0; r < rows; r++) {
    var row = [];
    for (var c = 0; c < columns; c++) {
      row.push(data.getFormattedValue(r, c));
    }

    let dateObject = new Date(
      parseInt(row[2].split("-")[0]),
      parseInt(row[2].split("-")[1]) - 1, // VERY confusing, Jan = 0, Feb = 1, etc.
      parseInt(row[2].split("-")[2])
    );

    let elem = {
      id: row[0],
      interpolated: false,
      location: row[1],
      date: dateObject,
      date_string: row[2],
      salary: +row[3],
      salary_adjusted_metro: null,
      salary_adjusted_country: null,
    };

    inflationAdjustMetro(elem);
    inflationAdjustNational(elem);

    if (prevElem != null && elem.id === prevElem.id) {
      interpolatedElem = { ...prevElem };
      interpolatedElem.date_string = elem.date_string;
      interpolatedElem.date = elem.date;
      interpolatedElem.interpolated = true;
      inflationAdjustMetro(interpolatedElem);
      inflationAdjustNational(interpolatedElem);
      array.push(interpolatedElem);
    } else if (prevElem != null) {
      interpolatedElem = { ...prevElem };
      interpolatedElem.date_string = "2022-05-22";
      interpolatedElem.date = new Date();
      interpolatedElem.interpolated = true;
      inflationAdjustMetro(interpolatedElem);
      inflationAdjustNational(interpolatedElem);
      array.push(interpolatedElem);
    }

    array.push(elem);
    prevElem = elem;
  }

  interpolatedElem = { ...prevElem };
  interpolatedElem.date_string = "2022-05-22";
  interpolatedElem.date = new Date();
  interpolatedElem.interpolated = true;
  inflationAdjustMetro(interpolatedElem);
  inflationAdjustNational(interpolatedElem);
  array.push(interpolatedElem);

  renderData(array);
  //Phoenix-Mesa-Scottsdale
}

function renderData(data) {
  const margin = { top: 30, right: 0, bottom: 30, left: 50 };
  const color = "steelblue";
  const height = 400;
  const width = 800;

  // Getters
  let getSalary = (d) => d.salary;
  let getAdjustedSalaryMetro = (d) => d.salary_adjusted_metro;
  let getAdjustedSalaryNational = (d) => d.salary_adjusted_country;

  //   let nonInterpolatedData = data.filter((d) => !d.interpolated);
  //   let groupedNonInterpolatedData = d3
  //     .nest()
  //     .key((d) => d.id)
  //     .entries(nonInterpolatedData);

  let getDate = (d) => d.date;

  let selectedLine = null;

  //   function onLineClick(d) {
  //     selectedLine = d;
  //     updateSelected();
  //   }

  //   function clearSelectedLine() {
  //     selectedLine = null;
  //     updateSelected();
  //   }

  //   function updateSelected() {
  //     var allLines = d3.select("svg").selectAll("path");
  //     if (selectedLine === null) {
  //       allLines.style("opacity", 1);
  //     } else {
  //       allLines
  //         .filter(function (d) {
  //           return d === selectedLine;
  //         })
  //         .style("opacity", 1);

  //       allLines
  //         .filter(function (d) {
  //           return d !== selectedLine;
  //         })
  //         .style("opacity", 0.1);
  //     }

  // var SATM = d3.select("#table-SATM");
  // var SATV = d3.select("#table-SATV");
  // var ACT = d3.select("#table-ACT");
  // var GPA = d3.select("#table-GPA");

  // if (selectedPoint == null) {
  //   SATM.text("");
  //   SATV.text("");
  //   ACT.text("");
  //   GPA.text("");
  // } else {
  //   SATM.text(selectedPoint.SATM);
  //   SATV.text(selectedPoint.SATV);
  //   ACT.text(selectedPoint.ACT);
  //   GPA.text(selectedPoint.GPA);
  // }
  //   }

  // y Axes
  var salaryScale = d3
    .scaleLinear()
    .domain([0, d3.max(data, getAdjustedSalaryMetro)]) // TODO: reevaluate zero-aligned min yAxis
    .range([height - margin.bottom, margin.top]);

  // x Axes
  var dateScaleFrom2018 = d3
    .scaleTime()
    .domain([new Date(2018, 0, 1), Date.now()])
    .range([margin.left, width - margin.right]);

  var dateScaleFrom2012 = d3
    .scaleTime()
    .domain([new Date(2012, 0, 1), Date.now()])
    .range([margin.left, width - margin.right]);

  var dateScaleUnbound = d3
    .scaleTime()
    // .domain([new Date(2018, 0, 1), new Date(2022, 4, 22)])
    .domain([new Date(2018, 0, 1), Date.now()])
    .range([margin.left, width - margin.right]);

  var xAxis = d3.axisBottom(dateScaleUnbound).ticks(d3.timeMonth.every(3));
  // .tickFormat((d) => (d < d3.timeYear(d) ? d.getFullYear() : null));
  var yAxis = d3.axisLeft(salaryScale).ticks(10);

  let graph = d3
    .select("#graph")
    .attr("width", width)
    .attr("height", height)
    .attr("fill", color);

  let graphLines = graph.append("g").attr("id", "stepLines");

  graph
    .append("g")
    .attr("id", "xAxis")
    .attr("transform", "translate(0, 370)")
    .call(xAxis);

  graph
    .append("g")
    .attr("id", "yAxis")
    .attr("transform", "translate(50, 0)")
    .call(yAxis);

  grid = (g) => {
    g.attr("stroke", "currentColor")
      .attr("stroke-opacity", 0.1)
      .call((g) =>
        g
          .append("g")
          .selectAll("line")
          .data(dateScaleUnbound.ticks())
          .join("line")
          .attr("x1", (d) => 0.5 + dateScaleUnbound(d))
          .attr("x2", (d) => 0.5 + dateScaleUnbound(d))
          .attr("y1", margin.top)
          .attr("y2", height - margin.bottom)
      )
      .call((g) =>
        g
          .append("g")
          .selectAll("line")
          .data(salaryScale.ticks())
          .join("line")
          .attr("y1", (d) => 0.5 + salaryScale(d))
          .attr("y2", (d) => 0.5 + salaryScale(d))
          .attr("x1", margin.left)
          .attr("x2", width - margin.right)
      );
  };

  graph.append("g").call(grid);

  var groupedData = d3
    .nest()
    .key((d) => d.id)
    .entries(data);

  for (let i = 0; i < groupedData.length; i++) {
    groupedData[i].location = groupedData[i].values[0].location;
  }

  console.log(groupedData);

  graphLines
    .selectAll("path")
    .data(groupedData)
    .enter()
    .append("path")
    .style("opacity", 1)
    .attr("fill", "none")
    .attr("stroke", "black")
    .attr("stroke-width", 0.3);

  let filterLocation = "All";
  let inflationAdjust = false;
  let filterString = "";

  graphTitle = d3.select("#graphTitle");

  function redrawGraphLines(xScale, xAccessor, yScale, yAccess, filter) {
    graphLines
      .transition()
      .duration(500)
      .selectAll("path")
      .attr("stroke", (d) => (d.key === "100K" ? "red" : "black"))
      .style("opacity", (d) => (filter(d) ? 1 : 0))
      .attr("d", (d) => {
        return d3
          .line()
          .x((d) => {
            return xScale(xAccessor(d));
          })
          .y((d) => {
            return yScale(yAccess(d));
          })(d.values);
      });

    //   .attr("stroke-width", (d) => (d.key === "100K" ? 1 : 0.3))
    filterBySearch();
  }

  function updateTitle(newTitle) {
    graphTitle.transition().duration(500).text(newTitle);
  }

  function renderView() {
    switch (filterLocation) {
      case "All":
        if (!inflationAdjust) {
          redrawGraphLines(
            dateScaleUnbound,
            getDate,
            salaryScale,
            getSalary,
            (d) => true
          );
          updateTitle("Amex Developer Pay");
        } else {
          redrawGraphLines(
            dateScaleUnbound,
            getDate,
            salaryScale,
            getAdjustedSalaryNational,
            (d) => true
          );
          updateTitle(
            "Amex Developer Pay, adjusted for inflation nationally (April 2022 dollars)"
          );
        }
        break;
      case "Miami":
        if (!inflationAdjust) {
          redrawGraphLines(
            dateScaleUnbound,
            getDate,
            salaryScale,
            getSalary,
            (d) => d.location === "Miami"
          );
          updateTitle("Amex Developer Pay in Miami");
        } else {
          redrawGraphLines(
            dateScaleUnbound,
            getDate,
            salaryScale,
            getAdjustedSalaryMetro,
            (d) => d.location === "Miami"
          );
          updateTitle(
            "Amex Developer Pay in Miami, adjusted for local inflation (April 2022 dollars)"
          );
        }
        break;
      case "New York":
        if (!inflationAdjust) {
          redrawGraphLines(
            dateScaleUnbound,
            getDate,
            salaryScale,
            getSalary,
            (d) => d.location === "New York"
          );
          updateTitle("Amex Developer Pay in New York");
        } else {
          redrawGraphLines(
            dateScaleUnbound,
            getDate,
            salaryScale,
            getAdjustedSalaryMetro,
            (d) => d.location === "New York"
          );
          updateTitle(
            "Amex Developer Pay in New York, adjusted for local inflation (April 2022 dollars)"
          );
        }
        break;
      case "Phoenix":
        if (!inflationAdjust) {
          redrawGraphLines(
            dateScaleUnbound,
            getDate,
            salaryScale,
            getSalary,
            (d) => d.location === "Phoenix"
          );
          updateTitle("Amex Developer Pay in Phoenix");
        } else {
          redrawGraphLines(
            dateScaleUnbound,
            getDate,
            salaryScale,
            getAdjustedSalaryMetro,
            (d) => d.location === "Phoenix"
          );
          updateTitle(
            "Amex Developer Pay in Phoenix, adjusted for local inflation (April 2022 dollars)"
          );
        }
        break;
      case "Other":
        if (!inflationAdjust) {
          redrawGraphLines(
            dateScaleUnbound,
            getDate,
            salaryScale,
            getSalary,
            (d) =>
              d.location !== "Phoenix" &&
              d.location !== "Miami" &&
              d.location !== "New York"
          );
          updateTitle("Amex Developer Pay (Other)");
        } else {
          redrawGraphLines(
            dateScaleUnbound,
            getDate,
            salaryScale,
            getAdjustedSalaryNational,
            (d) =>
              d.location !== "Phoenix" &&
              d.location !== "Miami" &&
              d.location !== "New York"
          );
          updateTitle(
            "Amex Developer Pay (Other), adjusted for national inflation (April 2022 dollars)"
          );
        }
        break;
    }
  }

  renderView();

  let locationButtons = [
    {
      id: "All",
      text: "All",
      default: true,
      click: function () {
        filterLocation = "All";
        renderView();
      },
    },
    {
      id: "Miami",
      text: "Miami",
      default: false,
      click: function () {
        filterLocation = "Miami";
        renderView();
      },
    },
    {
      id: "New York",
      text: "New York",
      default: false,
      click: function () {
        filterLocation = "New York";
        renderView();
      },
    },
    {
      id: "Phoenix",
      text: "Phoenix",
      default: false,
      click: function () {
        filterLocation = "Phoenix";
        renderView();
      },
    },
    {
      id: "Other",
      text: "Other",
      default: false,
      click: function () {
        filterLocation = "Other";
        renderView();
      },
    },
  ];

  let inflationButtons = [
    {
      id: "No",
      text: "No",
      default: true,
      click: function () {
        inflationAdjust = false;
        renderView();
      },
    },
    {
      id: "Yes",
      text: "Yes",
      default: false,
      click: function () {
        inflationAdjust = true;
        renderView();
      },
    },
  ];

  function makeRadioButtons(buttons, name, title) {
    d3.select("body").append("h6").text(title);
    let form = d3
      .select("body")
      .append("form")
      .attr("id", name)
      .attr("class", "btn-group btn-group-toggle")
      .attr("data-toggle", "buttons")
      .selectAll("button")
      .data(buttons)
      .enter()
      .append("label")
      .attr("class", (d) => `btn btn-secondary ${d.default ? "active" : ""}`)
      .text((d) => {
        return d.text;
      })
      .on("click", function (d) {
        return d.click();
      });
    form
      .append("input")
      .attr("type", "radio")
      .attr("id", function (d) {
        return d.id;
      });
    form.append("br");
  }

  makeRadioButtons(locationButtons, "locationButtons", "Location");
  makeRadioButtons(
    inflationButtons,
    "inflationButtons",
    "Adjust for inflation?"
  );
  function filterBySearch() {
    if (filterString === "") {
      graphLines
        // .transition()
        .selectAll("path")
        .attr("stroke-width", (d) => (d.key === "100K" ? 1.5 : 0.3));
    } else {
      graphLines
        // .transition()
        // .duration(50)
        .selectAll("path")
        .attr("stroke-width", (d) =>
          d.key.toLowerCase().includes(filterString) || d.key === "100K"
            ? 1.5
            : 0.1
        );
    }
  }

  d3.select("#search").on("keyup", function (d) {
    filterString = $(this).val().toLowerCase();
    filterBySearch();
  });
  d3.select("#search").on("paste", function (d) {
    filterString = $(this).val().toLowerCase();
    filterBySearch();
  });
  d3.select("#search").on("change", function (d) {
    filterString = $(this).val().toLowerCase();
    filterBySearch();
  });

  d3.select("body").append("br");
  d3.select("body").append("h3").text("Notes");
  d3.select("body")
    .append("p")
    .text(
      "This data is sourced from the Buraeu of Labor Statistics, the agency tasked with tracking inflation in the United States."
    );
  d3.select("body")
    .append("p")
    .text(
      "When inflation is shown, is uses regional data when cities are selected or national data otherwise"
    );
  d3.select("body")
    .append("p")
    .text(
      "Inflation is scaled to CURRENT dollars. You will see how every dollar went further in the past, and how long stretches without a pay increase devalue over time."
    );
  d3.select("body")
    .append("p")
    .text(
      "Inflation from April 2021 to April 2022 (the most recent data) was 8.6% nationally, 6.3% in New York, 9.6% in Miami, and 11% in Phoenix."
    );
  d3.select("body")
    .append("p")
    .text("The red line is a reference line at $100,000");
  // var xAxisButtonsList = [
  //     {
  //         id: "SATM",
  //         text: "SATM",
  //         click: function () {
  //             scatterPlotOne.transition().duration(3000).selectAll("circle")
  //                 .attr("cx", function (d) { return cxScale(d.SATM); });
  //             d3.select("#xAxis").transition().duration(3000)
  //                 .call(d3.axisBottom(cxScale).ticks(10));
  //         }
  //     },
  //     {
  //         id: "SAT-cumulative",
  //         text: "SATM + SATV",
  //         click: function () {
  //             scatterPlotOne.transition().duration(3000).selectAll("circle")
  //                 .attr("cx", function (d) { return scatterPlotOneAlternativeCXScale(d.SATV + d.SATM); });
  //             d3.select("#xAxis").transition().duration(3000)
  //                 .call(d3.axisBottom(scatterPlotOneAlternativeCXScale).ticks(10));
  //         }
  //     }
  // ];

  // d3.select("body").append("div").attr("id", "xAxisButtons").selectAll("button")
  //     .data(xAxisButtonsList).enter().append("button")
  //     .attr("id",     function (d) { return d.id; })
  //     .text(          function (d) { return d.text; })
  //     .on("click",    function (d) { return d.click(); });
}
