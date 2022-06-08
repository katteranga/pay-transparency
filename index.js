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

  renderData(combinedData, referenceData, flattenedData);
}

function renderData(combinedData, referenceData, flattenedData) {
  const margin = { top: 30, right: 0, bottom: 30, left: 50 };
  const color = "steelblue";
  const height = 400;
  const width = 800;

  // Getters
  let getDate = (d) => d.date;

  let getSalary = (d) => d.salary;
  let getAdjustedSalaryMetro = (d) => d.salary_metro_adjusted;
  let getAdjustedSalaryNational = (d) => d.salary_national_adjusted;

  // y Axes
  var salaryScale = d3
    .scaleLinear()
    .domain([0, 150000]) // TODO: reevaluate zero-aligned min yAxis
    .range([height - margin.bottom, margin.top]);

  // x Axes
  var dateScaleAll = d3
    .scaleTime()
    .domain([
      new Date(
        Math.min.apply(
          null,
          flattenedData.map((d) => d.date)
        )
      ),
      Date.now(),
    ])
    .range([margin.left, width - margin.right]);

  var dateScaleFrom2012 = d3
    .scaleTime()
    .domain([new Date(2012, 0, 1), Date.now()])
    .range([margin.left, width - margin.right]);

  var dateScaleFrom2018 = d3
    .scaleTime()
    .domain([new Date(2018, 0, 1), Date.now()])
    .range([margin.left, width - margin.right]);

  // Make Graph
  let graph = d3
    .select("#graph")
    .attr("width", width)
    .attr("height", height)
    .attr("fill", color);

  // Add x axis to graph
  let xAxis = graph
    .append("g")
    .attr("id", "xAxis")
    .attr("transform", "translate(0, 370)");
  // .call(xAxis);

  // Add y axis to graph
  let yAxis = graph
    .append("g")
    .attr("id", "yAxis")
    .attr("transform", "translate(50, 0)");
  // .call(yAxis);

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

    graphSettings.hover = find(mx, my);

    if (!graphSettings.hover) {
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
          <strong>${graphSettings.hover.id}</strong>
        </div>
          <div class="flex">
          <div>${d3.timeFormat("%B %d, %Y")(
            graphSettings.xAccessor(graphSettings.hover)
          )}</div>
          <div>${d3.format("$.0f")(
            graphSettings.yAccessor(graphSettings.hover)
          )}</div>
        </div>`
      );

    highlight
      .attr("opacity", 1)
      .attr(
        "cx",
        graphSettings.xScale(graphSettings.xAccessor(graphSettings.hover))
      )
      .attr(
        "cy",
        graphSettings.yScale(graphSettings.yAccessor(graphSettings.hover))
      );
  }

  find = (mx, my) => {
    const idx = graphSettings.delaunay.find(mx, my);

    if (idx !== null) {
      const datum = graphSettings.filteredData[idx];
      const d = distance(
        graphSettings.xScale(graphSettings.xAccessor(datum)),
        graphSettings.yScale(graphSettings.yAccessor(datum)),
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

  let grid = graph.append("g").attr("id", "grid");
  grid.append("g").attr("id", "horizontalGridLines");
  grid.append("g").attr("id", "verticalGridLines");

  // Transparent rect for interaction
  graph
    .append("rect")
    .attr("fill", "transparent")
    .attr("width", width)
    .attr("height", height)
    .on("mousemove", mousemoved)
    .on("mouseleave", mouseleft);

  graphTitle = d3.select("#graphTitle");
  graphSubtitle = d3.select("#graphSubtitle");

  d3.select("svg").append("g").attr("id", "graphLines");

  tooltip = d3
    .select("#tooltip")
    .style("width", "200px")
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

  let graphSettings = {
    filterLocation: "National",
    inflationAdjust: false,
    filterString: "",

    hover: null,
    delaunay: null,
    filteredData: null,

    filter: null,
    xScale: null,
    yScale: null,
    xAccessor: getDate,
    yAccessor: null,

    title: "",
    subtitle: "",
    tooltipSalary: "",
  };

  function redrawGraphLines() {
    graphTitle.transition().duration(500).text(graphSettings.title);
    graphSubtitle.transition().duration(500).text(graphSettings.subtitle);

    graphLines = d3
      .select("#graphLines")
      .selectAll("path")
      .data(combinedData.filter(graphSettings.filter));

    graphLines
      .exit()
      .attr("opacity", 1)
      .transition()
      .duration(500)
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
          .x((d) => graphSettings.xScale(graphSettings.xAccessor(d)))
          .y((d) => graphSettings.yScale(graphSettings.yAccessor(d)))(
          d.values.filter(
            (d) =>
              graphSettings.xScale.domain()[0] <= d.date &&
              d.date <= graphSettings.xScale.domain()[1]
          )
        )
      )
      .attr("opacity", 1);

    d3.select("#referenceLine100K")
      .transition()
      .duration(500)
      .attr("d", (referenceData) => {
        return d3
          .line()
          .x((d) => graphSettings.xScale(d.date))
          .y((d) =>
            graphSettings.yScale(
              graphSettings.inflationAdjust ? d.salary : 100000
            )
          )(
          referenceData[graphSettings.filterLocation].filter(
            (d) =>
              graphSettings.xScale.domain()[0] <= d.date &&
              d.date <= graphSettings.xScale.domain()[1]
          )
        );
      });

    d3.select("#referenceLine100K").data();

    xAxis.transition(500).call(d3.axisBottom(graphSettings.xScale));
    // .ticks(d3.timeMonth.every(3)));
    yAxis.transition(500).call(d3.axisLeft(graphSettings.yScale).ticks(10));

    let horizontalGridLines = d3
      .select("#horizontalGridLines")
      .selectAll("line")
      .data(graphSettings.yScale.ticks());

    let verticalGridLines = d3
      .select("#verticalGridLines")
      .selectAll("line")
      .data(graphSettings.xScale.ticks());

    horizontalGridLines.exit().transition().duration(500).remove();

    horizontalGridLines
      .enter()
      .append("line")
      .attr("class", "horizontalGrid")
      .attr("x1", margin.left)
      .attr("x2", width)
      .attr("fill", "none")
      .attr("shape-rendering", "crispEdges")
      .attr("stroke", "black")
      .attr("stroke-width", "1px")
      .attr("stroke-opacity", 0.1)
      // Update
      .merge(horizontalGridLines)
      // .transition()
      // .duration(1000)
      .attr("y1", (d) => graphSettings.yScale(d))
      .attr("y2", (d) => graphSettings.yScale(d));

    verticalGridLines.exit().transition().duration(500).remove();

    verticalGridLines
      .enter()
      .append("line")
      .attr("class", "horizontalGrid")
      .attr("y1", margin.top)
      .attr("y2", height - margin.bottom)
      .attr("fill", "none")
      .attr("shape-rendering", "crispEdges")
      .attr("stroke", "black")
      .attr("stroke-width", "1px")
      .attr("stroke-opacity", 0.1)
      // Update
      .merge(verticalGridLines)
      // .transition()
      // .duration(1000)
      .attr("x1", (d) => graphSettings.xScale(d))
      .attr("x2", (d) => graphSettings.xScale(d));

    filterBySearch();
  }

  function renderView() {
    switch (graphSettings.filterLocation) {
      case "National":
        graphSettings.filter = (d) => true;
        graphSettings.xScale = dateScaleFrom2012;
        graphSettings.yScale = salaryScale;
        graphSettings.title = "Amex Developer Pay";
        if (!graphSettings.inflationAdjust) {
          graphSettings.yAccessor = getSalary;
          graphSettings.subtitle = "\u00a0";
          graphSettings.tooltipSalary = "Nominal salary";
        } else {
          graphSettings.yAccessor = getAdjustedSalaryNational;
          graphSettings.subtitle =
            "Adjusted for national inflation (Current dollars)";
          graphSettings.tooltipSalary = "Real salary";
        }
        break;

      case "Miami":
        graphSettings.filter = (d) => d.location === "Miami";
        graphSettings.xScale = dateScaleFrom2012;
        graphSettings.yScale = salaryScale;
        graphSettings.title = "Amex Developer Pay in Miami";
        if (!graphSettings.inflationAdjust) {
          graphSettings.yAccessor = getSalary;
          graphSettings.subtitle = "\u00a0";
          graphSettings.tooltipSalary = "Nominal salary";
        } else {
          graphSettings.yAccessor = getAdjustedSalaryMetro;
          graphSettings.subtitle =
            "Adjusted for local inflation (Current dollars)";
          graphSettings.tooltipSalary = "Real salary";
        }
        break;

      case "New York":
        graphSettings.filter = (d) => d.location === "New York";
        graphSettings.xScale = dateScaleFrom2012;
        graphSettings.yScale = salaryScale;
        graphSettings.title = "Amex Developer Pay in New York";
        if (!graphSettings.inflationAdjust) {
          graphSettings.yAccessor = getSalary;
          graphSettings.subtitle = "\u00a0";
          graphSettings.tooltipSalary = "Nominal salary";
        } else {
          graphSettings.yAccessor = getAdjustedSalaryMetro;
          graphSettings.subtitle =
            "Adjusted for local inflation (Current dollars)";
          graphSettings.tooltipSalary = "Real salary";
        }
        break;

      case "Phoenix":
        graphSettings.filter = (d) => d.location === "Phoenix";
        graphSettings.xScale = dateScaleFrom2012;
        graphSettings.yScale = salaryScale;
        graphSettings.title = "Amex Developer Pay in Phoenix";
        if (!graphSettings.inflationAdjust) {
          graphSettings.yAccessor = getSalary;
          graphSettings.subtitle = "\u00a0";
          graphSettings.tooltipSalary = "Nominal salary";
        } else {
          graphSettings.yAccessor = getAdjustedSalaryMetro;
          graphSettings.subtitle =
            "Adjusted for local inflation (Current dollars)";
          graphSettings.tooltipSalary = "Real salary";
        }
        break;

      case "Other":
        graphSettings.filter = (d) =>
          d.location !== "Phoenix" &&
          d.location !== "Miami" &&
          d.location !== "New York";
        graphSettings.xScale = dateScaleFrom2012;
        graphSettings.yScale = salaryScale;
        graphSettings.title = "Amex Developer Pay in other cities";

        if (!graphSettings.inflationAdjust) {
          graphSettings.yAccessor = getSalary;
          graphSettings.subtitle = "\u00a0";
          graphSettings.tooltipSalary = "Nominal salary";
        } else {
          graphSettings.yAccessor = getAdjustedSalaryNational;
          graphSettings.subtitle =
            "Adjusted for national inflation (Current dollars)";
          graphSettings.tooltipSalary = "Real salary";
        }
        break;
    }

    redrawGraphLines();
  }

  renderView();

  let locationButtons = [
    {
      id: "All",
      text: "All",
      default: true,
      click: function () {
        graphSettings.filterLocation = "National";
        renderView();
      },
    },
    {
      id: "Miami",
      text: "Miami",
      default: false,
      click: function () {
        graphSettings.filterLocation = "Miami";
        renderView();
      },
    },
    {
      id: "New York",
      text: "New York",
      default: false,
      click: function () {
        graphSettings.filterLocation = "New York";
        renderView();
      },
    },
    {
      id: "Phoenix",
      text: "Phoenix",
      default: false,
      click: function () {
        graphSettings.filterLocation = "Phoenix";
        renderView();
      },
    },
    {
      id: "Other",
      text: "Other",
      default: false,
      click: function () {
        graphSettings.filterLocation = "Other";
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
        graphSettings.inflationAdjust = false;
        renderView();
      },
    },
    {
      id: "Yes",
      text: "Yes",
      default: false,
      click: function () {
        graphSettings.inflationAdjust = true;
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
    if (graphSettings.filterString === "") {
      d3.select("#graphLines")
        .selectAll("path")
        .attr("stroke-width", (d) => (d.id === "100K" ? 1.5 : 0.3));
      graphSettings.delaunay = d3.Delaunay.from(
        flattenedData,
        (d) => graphSettings.xScale(graphSettings.xAccessor(d)),
        (d) => graphSettings.yScale(graphSettings.yAccessor(d))
      );
      graphSettings.filteredData = flattenedData;
    } else {
      d3.select("#graphLines")
        .selectAll("path")
        .attr("stroke-width", (d) => {
          return d.id.toLowerCase().includes(graphSettings.filterString) ||
            d.id === "100K"
            ? 1.5
            : 0.1;
        });
      graphSettings.delaunay = d3.Delaunay.from(
        flattenedData.filter((d) =>
          d.id.toLowerCase().includes(graphSettings.filterString)
        ),
        (d) => graphSettings.xScale(graphSettings.xAccessor(d)),
        (d) => graphSettings.yScale(graphSettings.yAccessor(d))
      );
      graphSettings.filteredData = flattenedData.filter((d) =>
        d.id.toLowerCase().includes(graphSettings.filterString)
      );
    }
    return;
  }

  function onSearch() {
    graphSettings.filterString = $(this).val().toLowerCase();
    filterBySearch();
  }

  d3.select("#search")
    .on("keyup", onSearch)
    .on("paste", onSearch)
    .on("change", onSearch);
}

init();
