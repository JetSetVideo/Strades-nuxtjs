<script setup>
import * as d3 from "d3";
import { useBitcoinStore } from "@/stores/BitcoinStore.ts";

// emit declaration
const emit = defineEmits(["mouseUp"]);

// props declaration
const props = defineProps({ isLine: Boolean });

// data import
const bitcoin = useBitcoinStore();
const json = bitcoin.bitcoinPrices;

// ref declaration
const canvas = ref(null);
const candle = ref(null);

onMounted(() => {
  // variable declaration
  var totalWidth = window.innerWidth - 100;
  var totalHeight = window.innerHeight - 150;

  var margin = { top: 10, left: 50, bottom: 30, right: 50 };

  var width = totalWidth - margin.left - margin.right;
  var height = totalHeight - margin.top - margin.bottom;

  // drawing start point coordinate
  var x1 = 0;
  var y1 = 0;

  // mouse click count
  var downCount = 0;
  var isLineDragging = false;
  var isCircleDragging = false;
  var selectedLine = null;
  var selectedCircle = null;

  // data stuff
  var formatDecimal = d3.format(",.2f");

  var parseDate = d3.timeParse("%Y%m%d"); // 20150630

  var outputFormat = d3.timeFormat("%d %b %Y"); // 30 June 2015

  // data type casting function
  var dataModelJSON = function (d) {
    return {
      date: parseDate(+d.date),
      open: +d.open,
      high: +d.high,
      low: +d.low,
      close: +d.close,
      volume: +d.volume,
      openInt: +d.openInt,
    };
  };

  var xScale, xLabels, xAxis, yIsLinear, yDomain, yRange, yScale, yAxis;

  function prepareForBuild(data) {
    xScale = d3
      .scaleBand()
      .domain(
        data.map(function (d) {
          return d.date;
        })
      )
      .range([0, width])
      .paddingInner(0.2)
      .paddingOuter(0)
      .align(0.5);

    xLabels = xScale.domain().filter(function (d, i) {
      if (i === data.length - 1) return d;
      var next;

      if (data[i + 1]) {
        next = data[i + 1].date;
      } else {
        return false;
      }

      var monthA = d.getMonth();
      var monthB = next.getMonth();

      return monthB > monthA ? d : monthB === 0 && monthA === 11 ? d : false;
    });

    xAxis = d3.axisBottom(xScale).tickFormat(outputFormat).tickValues(xLabels);

    yIsLinear = true;
    yDomain = [d3.min(data, (d) => d.low), d3.max(data, (d) => d.high)];
    yRange = [height, 0];
    yScale = d3.scaleLinear().domain(yDomain).range(yRange).nice(5);
    yAxis = d3
      .axisRight(yScale)
      .ticks(15)
      .tickSizeInner(-width)
      .tickFormat(formatDecimal);
  }

  function buildChart(data) {
    var svg = d3
      .select(candle.value)
      .append("svg")
      .attr("id", "candle-chart")
      .attr("width", totalWidth)
      .attr("height", totalHeight)
      .attr("cursor", "crosshair")
      .attr("class", "mx-auto")
      .on("mousedown", function (event) {
        // if clicked element is line or circle
        // if (d3.select(event.target).attr("key") == null) {
        //   d3.selectAll("circle").remove();
        // }
        // if line is not selected, return
        if (props.isLine === false) return;

        // increase mouse click count
        downCount++;

        // draw circle
        drawCircle(event);

        // if line is drawn, unselect line tool
        if (downCount % 2 == 0) {
          x1 = 0;
          y1 = 0;
          emit("mouseUp");
        }
      })
      .on("mousemove", function (event) {
        // drag line
        if (isLineDragging === true) {
          dragLine(event);
        }

        // drag circle
        if (isCircleDragging === true) {
          dragCircle(event);
        }

        // draw line
        if (downCount % 2 === 0 || props.isLine === false) return;
        drawLine(event);
      })
      .on("mouseup", function () {
        isLineDragging = false;
        isCircleDragging = false;
        d3.selectAll("line").attr("cursor", "pointer");
      });

    var mainGroup = svg
      .append("g")
      .attr("id", "mainGroup")
      .attr("transform", "translate( " + 0 + ", " + margin.top + ")");

    var xAxisGroup = mainGroup
      .append("g")
      .attr("id", "xAxis")
      .attr("class", "axis")
      .attr("transform", "translate( " + 0 + "," + height + ")")
      .call(customXAxis);

    function customXAxis(g) {
      g.call(xAxis);
      g.selectAll(".tick line")
        .attr("y1", -height)
        .attr("y2", 0)
        .attr("stroke", "#777")
        .attr("stroke-dasharray", "3,2");
    }
    var yAxisGroup = mainGroup
      .append("g")
      .attr("id", "yAxis")
      .attr("class", "axis")
      .attr("transform", "translate(" + width + ", " + 0 + ")")
      .call(customYAxis);

    function customYAxis(g) {
      g.call(yAxis);
      g.selectAll(".tick line")
        .attr("stroke", "#777")
        .attr("stroke-dasharray", "3,2");
      g.selectAll(".tick:first-of-type line").remove();

      g.selectAll(".tick text").attr("x", 9);
    }
    var eventGroup = mainGroup.append("g").attr("id", "event-overlay");

    var crosshair = eventGroup.append("g").attr("id", "crosshair");

    var eventRect = eventGroup.append("rect");

    var drawLineGroup = mainGroup.append("g").attr("id", "drawLineGroup");
    var drawCircleGroup = mainGroup.append("g").attr("id", "drawCircleGroup");

    var canvasGroup = eventGroup.append("g").attr("id", "circleGroup");

    // http://stackoverflow.com/questions/118241/calculate-text-width-with-javascript
    function getTextWidth(text, font) {
      var textWidth = 0;
      var context = canvas.value.getContext("2d");
      context.font = font;
      textWidth = context.measureText(text).width;
      return textWidth;
    }

    var crosshairSettings = {
      xLabelTextOffset: height + 12,
      yLabelTextOffset: -9,
      ylabelWidth:
        getTextWidth(formatDecimal(yDomain[1]), "10px sans-serif") + 10,
      xlabelWidth: getTextWidth("30 September 2000", "10px sans-serif"),
      labelHeight: 15,
      labelColor: "#aaa",
      labelStrokeColor: "none",
      labelStrokeWidth: "0.5px",
    };

    crosshair
      .append("line")
      .attr("id", "focusLineX")
      .attr("class", "focusLine");

    crosshair
      .append("line")
      .attr("id", "focusLineY")
      .attr("class", "focusLine");

    crosshair
      .append("rect")
      .attr("id", "focusLineXLabelBackground")
      .attr("class", "focusLineLabelBackground")
      .attr("fill", crosshairSettings.labelColor)
      .attr("stroke", crosshairSettings.labelStrokeColor)
      .attr("stroke-width", crosshairSettings.labelStrokeWidth)
      .attr("width", crosshairSettings.xlabelWidth)
      .attr("height", crosshairSettings.labelHeight);

    crosshair
      .append("text")
      .attr("id", "focusLineXLabel")
      .attr("class", "label")
      .attr("text-anchor", "middle")
      .attr("alignment-baseline", "central");

    var ylabel = crosshair.append("g").attr("id", "yLabelGroup");
    ylabel
      .append("rect")
      .attr("id", "focusLineYLabelBackground")
      .attr("class", "focusLineLabelBackground")
      .attr("fill", crosshairSettings.labelColor)
      .attr("stroke", crosshairSettings.labelStrokeColor)
      .attr("stroke-width", crosshairSettings.labelStrokeWidth)
      .attr("width", crosshairSettings.ylabelWidth)
      .attr("height", crosshairSettings.labelHeight);

    ylabel
      .append("text")
      .attr("id", "focusLineYLabel")
      .attr("class", "label")
      .attr("text-anchor", "end")
      .attr("alignment-baseline", "central");

    setCrosshair(width, 0);

    var candleSettings = {
      stroke: "black",
      up: "green",
      down: "#d30000",
      hover: "#ffffff",
      lineMode: false,
    };

    canvasGroup
      .selectAll("line")
      .data(data)
      .enter()
      .append("line")
      .attr("x1", function (d, i) {
        return xScale(d.date) + xScale.bandwidth() * 0.5;
      })
      .attr("y1", function (d) {
        return yScale(d["high"]);
      })
      .attr("x2", function (d, i) {
        return xScale(d.date) + xScale.bandwidth() * 0.5;
      })
      .attr("y2", function (d) {
        return yScale(d["low"]);
      })
      .style("stroke", function (d) {
        return d.close > d.open ? candleSettings.up : candleSettings.down;
      })
      .style("stroke-width", "1px")
      .style("opacity", 1);

    if (xScale.bandwidth() > 1) {
      candleSettings.lineMode = false;
      canvasGroup
        .selectAll("rect")
        .data(data)
        .enter()
        .append("rect")
        .attr("x", function (d, i) {
          return xScale(d.date);
        })
        .attr("y", function (d, i) {
          return yScale(Math.max(d.close, d.open));
        })
        .attr("width", xScale.bandwidth())
        .attr("height", function (d, i) {
          var max = yScale(Math.min(d.close, d.open));
          var min = yScale(Math.max(d.close, d.open));
          var diff = max - min;
          return diff || 0.1;
        })
        .style("fill", function (d) {
          return d.close > d.open ? candleSettings.up : candleSettings.down;
        });
      // .style("stroke", candleSettings.stroke);
    } else {
      candleSettings.lineMode = true;
    }

    var els = candleSettings.lineMode
      ? canvasGroup.selectAll("line")
      : canvasGroup.selectAll("rect");
    els
      .on("mouseover", function (d, i) {
        d3.select(this).attr("cursor", "pointer");
        // .style("stroke", candleSettings.hover);
        // crosshair.style("display", null);
        // setCrosshair(
        //   xScale(d.date) + xScale.bandwidth() * 0.5,
        //   yScale(d.close)
        // );
      })
      .on("mouseout", function (d, i) {
        // d3.select(this)
        //   .style("fill", function (d) {
        //     return d.close > d.open ? candleSettings.up : candleSettings.down;
        //   })
        //   .style("stroke", candleSettings.stroke)
        //   .style("stroke-width", "1px");
      });

    eventRect
      .attr("width", width)
      .attr("height", height)
      .style("opacity", 0.0)
      .style("display", null)
      .on("mouseover", function () {
        crosshair.style("display", null);
      })
      .on("mouseout", function () {
        crosshair.style("display", "none");
      })
      .on("mousemove", function handleMouseMove(event) {
        var x = event.x - 81;
        var y = event.y - 77.5;
 
        setCrosshair(x, y);
      });

    // drawing functions
    function drawCircle(event) {
      x1 = event.x - 81;
      y1 = event.y - 77.5;
      let circle = drawCircleGroup
        .append("circle")
        .attr("class", "draw-circle" + downCount)
        .attr("cx", event.x - 81)
        .attr("cy", event.y - 77.5)
        .attr("r", 7)
        .attr("stroke", "white")
        .attr("stroke-width", "2")
        .attr("cursor", "default")
        .attr("key", downCount);

      // circle dragging event
      circle.on("mousedown", function (event) {
        isCircleDragging = true;
        x1 = event.x;
        y1 = event.y;
        selectedCircle = d3.select(this);
      });
    }

    function drawLine(event) {
      d3.select(".draw-line" + downCount).remove();
      var line = drawLineGroup
        .append("line")
        .attr("class", "draw-line" + downCount)
        .attr("x1", x1)
        .attr("y1", y1)
        .attr("x2", event.x - 81)
        .attr("y2", event.y - 77.5)
        .attr("cursor", "pointer")
        .attr("stroke", "white")
        .attr("key", downCount)
        .style("stroke-width", "3");
      line
        .on("mousedown", function (event) {
          isLineDragging = true;
          x1 = event.x;
          y1 = event.y;
          selectedLine = this;
        })
        .on("mousemove", function (event) {
        });
      // .on("mouseover", function (event) {
      //   if (downCount % 2 === 1) return;
      //   let line = d3.select(this);
      //   let key = parseFloat(line.attr("key"));
      //   let x1 = parseFloat(line.attr("x1"));
      //   let y1 = parseFloat(line.attr("y1"));
      //   let x2 = parseFloat(line.attr("x2"));
      //   let y2 = parseFloat(line.attr("y2"));

      //   drawCircleGroup
      //     .append("circle")
      //     .attr("class", "draw-circle" + key)
      //     .attr("cx", x1)
      //     .attr("cy", y1)
      //     .attr("r", 7)
      //     .attr("stroke", "white")
      //     .attr("stroke-width", "2")
      //     .attr("cursor", "default")
      //     .attr("key", key)
      //     .on("mousedown", function (event) {
      //       isCircleDragging = true;
      //       x1 = event.x;
      //       y1 = event.y;
      //       selectedCircle = d3.select(this);
      //     });

      //   drawCircleGroup
      //     .append("circle")
      //     .attr("class", "draw-circle" + (key + 1))
      //     .attr("cx", x2)
      //     .attr("cy", y2)
      //     .attr("r", 7)
      //     .attr("stroke", "white")
      //     .attr("stroke-width", "2")
      //     .attr("cursor", "default")
      //     .attr("key", (key + 1))
      //     .on("mousedown", function (event) {
      //       isCircleDragging = true;
      //       x1 = event.x;
      //       y1 = event.y;
      //       selectedCircle = d3.select(this);
      //     });
      // });
    }

    function dragLine(event) {
      let line = d3.select(selectedLine);
      let key = parseFloat(line.attr("key"));

      let startCircle = d3.select(".draw-circle" + key);
      let endCircle = d3.select(".draw-circle" + (key + 1));

      let deltaX = event.x - x1;
      let deltaY = event.y - y1;

      startCircle.attr("cx", parseFloat(startCircle.attr("cx")) + deltaX);
      startCircle.attr("cy", parseFloat(startCircle.attr("cy")) + deltaY);

      endCircle.attr("cx", parseFloat(endCircle.attr("cx")) + deltaX);
      endCircle.attr("cy", parseFloat(endCircle.attr("cy")) + deltaY);

      line
        .attr("cursor", "grabbing")
        .attr("x1", parseFloat(line.attr("x1")) + deltaX)
        .attr("y1", parseFloat(line.attr("y1")) + deltaY)
        .attr("x2", parseFloat(line.attr("x2")) + deltaX)
        .attr("y2", parseFloat(line.attr("y2")) + deltaY);

      x1 = event.x;
      y1 = event.y;
    }

    function dragCircle(event) {
      let key = parseFloat(selectedCircle.attr("key"));

      let deltaX = event.x - x1;
      let deltaY = event.y - y1;

      selectedCircle.attr("cx", parseFloat(selectedCircle.attr("cx")) + deltaX);
      selectedCircle.attr("cy", parseFloat(selectedCircle.attr("cy")) + deltaY);

      if (key % 2 === 0) {
        let line = d3.select(".draw-line" + (key - 1));
        line
          .attr("x2", parseFloat(line.attr("x2")) + deltaX)
          .attr("y2", parseFloat(line.attr("y2")) + deltaY);
      } else {
        let line = d3.select(".draw-line" + key);
        line
          .attr("x1", parseFloat(line.attr("x1")) + deltaX)
          .attr("y1", parseFloat(line.attr("y1")) + deltaY);
      }

      x1 = event.x;
      y1 = event.y;
    }

    function setCrosshair(x, y) {
      d3.select("#focusLineX")
        .attr("x1", x)
        .attr("y1", 0)
        .attr("x2", x)
        .attr("y2", height + 6);

      d3.select("#focusLineY")
        .attr("x1", 0)
        .attr("y1", y)
        .attr("x2", width + 6)
        .attr("y2", y);

      d3.select("#focusLineXLabel")
        .attr("x", x)
        .attr("y", height + 12)
        .text(outputFormat(xScale.domain()[Math.floor(x / xScale.step())]));

      d3.select("#focusLineXLabelBackground")
        .attr(
          "transform",
          "translate( " +
            (x - crosshairSettings.xlabelWidth * 0.5) +
            " , " +
            (height + 6) +
            " )"
        )
        .text(outputFormat(xScale.domain()[Math.floor(x / xScale.step())]));

      d3.select("#focusLineYLabel")
        .attr("transform", "translate( " + (width - 9 + 50) + ", " + y + ")")
        .text(formatDecimal(yScale.invert(y)));
      d3.select("#focusLineYLabelBackground").attr(
        "transform",
        "translate( " +
          (width - crosshairSettings.ylabelWidth - 6 + 50) +
          ", " +
          (y - 6) +
          ")"
      );
    }
  }

  // data loading
  var data = json.map(dataModelJSON);
  prepareForBuild(data);
  buildChart(data);
});
</script>
<template>
  <div ref="candle" class="grow bg-[#161a25] rounded"></div>
  <canvas ref="canvas" class="hidden"></canvas>
</template>
<style scoped>
.label {
  fill: #fff;
  font-family: sans-serif;
  font-size: 12px;
  line-height: 1;
  vertical-align: middle;
}

text {
  fill: #777;
  font-size: 12px;
}

rect {
  shape-rendering: crispEdges;
  stroke-width: 1px;
}

line {
  shape-rendering: crispEdges;
  stroke-width: 1px;
}
line.focusLine {
  stroke: #777;
  stroke-linecap: butt;
}

.domain {
  stroke: #777;
  stroke-width: 1px;
}
</style>
