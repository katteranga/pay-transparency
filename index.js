function init() {
  fetch("./combinedData.json")
    .then((response) => response.json())
    .then((combinedData) =>
      fetch("./referenceLine100K.json")
        .then((response) => response.json())
        .then((referenceData) => processSheetsData(combinedData, referenceData))
    );
}

function processSheetsData(combinedData, referenceData) {
  // Interpret all the date strings as JavaScript date objects
  for (const id in combinedData) {
    for (let i = 0; i < combinedData[id].values.length; i++) {
      let current_date_string = combinedData[id].values[i].date_string;
      combinedData[id].values[i].date = new Date(
        parseInt(current_date_string.split("-")[0]),
        parseInt(current_date_string.split("-")[1]) - 1, // VERY confusing, Jan = 0, Feb = 1, etc.
        parseInt(current_date_string.split("-")[2])
      );
    }
  }

  for (const region in referenceData) {
    for (let i = 0; i < referenceData[region].length; i++) {
      let current_date_string = referenceData[region][i].date_string;
      referenceData[region][i].date = new Date(
        parseInt(current_date_string.split("-")[0]),
        parseInt(current_date_string.split("-")[1]) - 1, // VERY confusing, Jan = 0, Feb = 1, etc.
        parseInt(current_date_string.split("-")[2])
      );
    }
  }

  // interpolatedElem = { ...prevElem };
  // interpolatedElem.date_string = "2022-05-22";
  // interpolatedElem.date = new Date();
  // interpolatedElem.interpolated = true;
  // inflationAdjustMetro(interpolatedElem);
  // inflationAdjustNational(interpolatedElem);
  // array.push(interpolatedElem);
  renderData(combinedData, referenceData);
  //Phoenix-Mesa-Scottsdale
}

function renderData(combinedData, referenceData) {
  const margin = { top: 30, right: 0, bottom: 30, left: 50 };
  const color = "steelblue";
  const height = 400;
  const width = 800;

  // Getters
  let getSalary = (d) => d.salary;
  let getAdjustedSalaryMetro = (d) => d.salary_metro_adjusted;
  let getAdjustedSalaryNational = (d) => d.salary_national_adjusted;

  let getDate = (d) => d.date;

  let selectedLine = null;

  // y Axes
  var salaryScale = d3
    .scaleLinear()
    .domain([0, 120000]) // TODO: reevaluate zero-aligned min yAxis
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

  var flattenedData = [];
  combinedData.forEach((entry) => {
    entry.values.forEach((payDatum) => {
      flattenedData.push({
        id: entry.id,
        education: entry.education,
        hiring_source: entry.hiring_source,
        // interpolated: payDatum.interpolated,
        date: payDatum.date,
        salary: payDatum.salary,
        salary_metro_adjusted: payDatum.salary_metro_adjusted,
        salary_national_adjusted: payDatum.salary_national_adjusted,
      });
    });
  });
  // console.log(flattenedData);
  // delaunay = d3.Delaunay.from(
  //   flattenedData,
  //   (d) => dateScaleUnbound(getDate(d)),
  //   (d) => salaryScale(getSalary(d))
  // );

  // console.log(delaunay);

  let hover;

  let highlight = graph
    .append("circle")
    // .attr("opacity", hover ? 1 : 0)
    .attr("opacity", 0)
    .attr("r", 3)
    // .attr("stroke-width", 2)
    .attr("fill", "black")
    // .attr("stroke", "black")
    // .attr("cx", hover ? dateScaleUnbound(hover.date) : null)
    .attr("cx", null)
    // .attr("cy", hover ? salaryScale(hover.salary) : null);
    .attr("cy", null);

  function mousemoved() {
    const [mx, my] = d3.mouse(d3.select(this).node());

    hover = find(mx, my);

    if (!hover) {
      highlight.attr("opacity", 0);
      return mouseleft();
    }

    const xRatio = mx / width;

    tooltip
      .style("display", "block")
      .style(
        "left",
        `${xRatio > 0.75 ? mx - 100 : xRatio < 0.15 ? mx + 100 : mx}px`
      )
      .style("top", `${my + 230}px`)
      .html(
        `<div>
          <strong>${hover.id}</strong>
        </div>
          <div class="flex">
          <div>${d3.timeFormat("%B %d, %Y")(hover.date)}</div>
          <div>${d3.format("$.0f")(hover.salary)}</div>
        </div>`
      );

    highlight
      .attr("opacity", 1)
      .attr("cx", dateScaleUnbound(hover.date))
      .attr("cy", salaryScale(hover.salary));
    // .html(`<h1>Here</h1>`);
  }

  find = (mx, my) => {
    const idx = delaunay.find(mx, my);

    if (idx !== null) {
      const datum = flattenedData[idx];
      const d = distance(
        dateScaleUnbound(datum.date),
        salaryScale(datum.salary),
        mx,
        my
      );

      return d < 100 ? datum : null;
    }

    return null;
  };

  distance = (px, py, mx, my) => {
    const a = px - mx;
    const b = py - my;

    return Math.sqrt(a * a + b * b);
  };

  mouseleft = () => {
    tooltip.style("display", "none");
  };
  // Transparent rect for interaction

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

  // tooltip = {
  //   const div = d3.create('div')
  // }

  graph.append("g").call(grid);

  graph
    .append("rect")
    .attr("fill", "transparent")
    .attr("width", width)
    .attr("height", height)
    .on("mousemove", mousemoved)
    .on("mouseleave", mouseleft);

  let filterLocation = "National";
  let inflationAdjust = false;
  let filterString = "";

  graphTitle = d3.select("#graphTitle");
  graphSubtitle = d3.select("#graphSubtitle");

  d3.select("svg").append("g").attr("id", "graphLines");

  // .selectAll("path")
  // .data(combinedData);
  tooltip = d3
    .select("#tooltip")
    // .select("#graph")
    // .append("div")
    // .attr("id", "tooltip")
    .style("width", "200px")
    // .style("height", "200px")
    .style("position", "absolute")
    .style("padding", "8px")
    .style("border", "1px solid #ccc")
    .style("pointer-events", "none")
    .style("background", "white")
    .style("display", "none");

  graph
    .append("g")
    .attr("id", "referenceLines")
    .selectAll("path")
    .data([referenceData])
    .enter()
    .append("path")
    .attr("stroke", "red")
    .attr("fill", "none")
    .attr("stroke-width", 1.5)
    .attr("id", "referenceLine100K");
  // .attr("id", "referenceLine100K");

  function redrawGraphLines(xScale, xAccessor, yScale, yAccessor, filter) {
    graphLines = d3
      .select("#graphLines")
      .selectAll("path")
      .data(combinedData.filter(filter));

    graphLines
      .exit()
      .attr("opacity", 1)
      .transition()
      .duration(300)
      .attr("opacity", 0)
      .remove();

    graphLines
      .enter()
      .append("path")
      .attr("fill", "none")
      .attr("stroke", "black")
      .attr("stroke-width", 0.3)
      .attr("opacity", 0)
      // Update
      .merge(graphLines)
      .transition()
      .duration(500)
      .attr("d", (d) =>
        d3
          .line()
          .x((d) => xScale(xAccessor(d)))
          .y((d) => yScale(yAccessor(d)))(d.values)
      )
      .attr("opacity", 1);

    d3.select("#referenceLine100K")
      .transition()
      .duration(500)
      .attr("d", (referenceData) => {
        return d3
          .line()
          .x((d) => xScale(d.date))
          .y((d) => yScale(inflationAdjust ? d.salary : 100000))(
          referenceData[filterLocation].filter((d) => {
            return xScale.domain()[0] <= d.date && d.date <= xScale.domain()[1];
          })
        );
      });

    filterBySearch();
  }

  function updateTitle(newTitle, newSubtitle) {
    graphTitle.transition().duration(500).text(newTitle);
    graphSubtitle.transition().duration(500).text(newSubtitle);
  }

  function renderView() {
    switch (filterLocation) {
      case "National":
        if (!inflationAdjust) {
          redrawGraphLines(
            dateScaleUnbound,
            getDate,
            salaryScale,
            getSalary,
            (d) => true
          );
          updateTitle("Amex Developer Pay", "\u00a0");
        } else {
          redrawGraphLines(
            dateScaleUnbound,
            getDate,
            salaryScale,
            getAdjustedSalaryNational,
            (d) => true
          );
          updateTitle("Amex Developer Pay", "Adjusted for national inflation");
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
          updateTitle("Amex Developer Pay in Miami", "\u00a0");
        } else {
          redrawGraphLines(
            dateScaleUnbound,
            getDate,
            salaryScale,
            getAdjustedSalaryMetro,
            (d) => d.location === "Miami"
          );
          updateTitle(
            "Amex Developer Pay in Miami",
            "Adjusted for local inflation"
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
          updateTitle("Amex Developer Pay in New York", "\u00a0");
        } else {
          redrawGraphLines(
            dateScaleUnbound,
            getDate,
            salaryScale,
            getAdjustedSalaryMetro,
            (d) => d.location === "New York"
          );
          updateTitle(
            "Amex Developer Pay in New York",
            "Adjusted for local inflation"
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
          updateTitle("Amex Developer Pay in Phoenix", "\u00a0");
        } else {
          redrawGraphLines(
            dateScaleUnbound,
            getDate,
            salaryScale,
            getAdjustedSalaryMetro,
            (d) => d.location === "Phoenix"
          );
          updateTitle(
            "Amex Developer Pay in Phoenix",
            "Adjusted for local inflation"
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
          updateTitle("Amex Developer Pay in other cities", "\u00a0");
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
            "Amex Developer Pay in other cities",
            "Adjusted for national inflation"
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
        filterLocation = "National";
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
      .attr("data-toggle", "buttons");

    buttons = form
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
    buttons
      .append("input")
      .attr("type", "radio")
      .attr("id", function (d) {
        return d.id;
      });
  }

  makeRadioButtons(locationButtons, "locationButtons", "Location");
  makeRadioButtons(
    inflationButtons,
    "inflationButtons",
    "Adjust for inflation?"
  );
  function filterBySearch() {
    if (filterString === "") {
      d3.select("#graphLines")
        .selectAll("path")
        .attr("stroke-width", (d) => (d.id === "100K" ? 1.5 : 0.3));
      delaunay = d3.Delaunay.from(
        flattenedData,
        (d) => dateScaleUnbound(getDate(d)),
        (d) => salaryScale(getSalary(d))
      );
    } else {
      d3.select("#graphLines")
        .selectAll("path")
        .attr("stroke-width", (d) => {
          return d.id.toLowerCase().includes(filterString) || d.id === "100K"
            ? 1.5
            : 0.1;
        });
      delaunay = d3.Delaunay.from(
        flattenedData.filter((d) => d.id.toLowerCase().includes(filterString)),
        (d) => dateScaleUnbound(getDate(d)),
        (d) => salaryScale(getSalary(d))
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

  // html`<style>
  //   .flex {
  //     display: flex;
  //     justify-content: space-between;
  //   }
  //   .flex:not(:last-child) {
  //     border-bottom: 1px solid #eee;
  //     margin-bottom: 2px;
  //   }
  // </style>`;
}

init();

// width: 200px; position: absolute; padding: 8px; border: 1px solid rgb(204, 204, 204); pointer-events: none; background: white; display: none; left: 554px; top: 268.195px;
// width: 200px; position: absolute; padding: 8px; border: 1px solid rgb(204, 204, 204); pointer-events: none; background: white; display: block; left: 648px; top: 123.195px;
// width: 200px; position: absolute; padding: 8px; border: 1px solid rgb(204, 204, 204); pointer-events: none; background: white; display: none; left: 549px; top: 168.406px;"

// div displaying correctly
// width: 200px;
// position: absolute;
// padding: 8px;
// border: 1px solid rgb(204, 204, 204);
// pointer-events: none;
// background: white;
// display: block;
// left: 474px;
// top: 282.195px;
