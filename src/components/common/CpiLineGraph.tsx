import React, { useRef, memo, useContext } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
  ChartData,
  TimeScale,
} from "chart.js";
import "chartjs-adapter-date-fns";
import annotationPlugin from "chartjs-plugin-annotation";
import lighthouse from "@lighthouse-web3/sdk";
import { BsTwitterX, BsShare, BsDownload } from "react-icons/bs";
import html2canvas from "html2canvas";
import { SavingContext } from "./SavingContext";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  annotationPlugin,
  TimeScale
);

interface Event {
  name: string;
  startDate: string;
  endDate: string;
  color: string;
}

interface Annotation {
  [key: string]: any;
}

interface UploadResponse {
  success: boolean;
  imageUrl?: any;
  error?: string;
  status?: any; // Add specific types based on lighthouse response
}

type CouncilName =
  | "Token House"
  | "Citizen House"
  | "Grants Council"
  | "Grants Council (Milestone & Metrics Sub-committee)"
  | "Security Council"
  | "Code of Conduct Council"
  | "Developer Advisory Board";

// Define the activeRedistributed type as a partial record
type ActiveRedistributed = Partial<Record<CouncilName, number>>;

type CPIResult = {
  filename: string;
  cpi: number;
  activeRedistributed?: ActiveRedistributed;
};

type CouncilPercentages = {
  start_date: string;
  end_date: string;
  percentages: { [key: string]: number };
};

type CPILineGraphProps = {
  cpiResults: CPIResult[];
  initialCPI: CPIResult[];
};

interface TwitterMediaUploadResponse {
  media_id_string: string;
  media_id: number;
  size: number;
  expires_after_secs: number;
  image: {
    image_type: string;
    w: number;
    h: number;
  };
}

interface TwitterConfig {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
}

const HISTORICAL_PERCENTAGES: CouncilPercentages[] = [
  {
    start_date: "2023-01-26",
    end_date: "2024-01-03",
    percentages: {
      "Token House": 41.95,
      "Citizen House": 44.88,
      "Grants Council": 13.17,
    },
  },
  {
    start_date: "2024-01-04",
    end_date: "2024-12-11",
    percentages: {
      "Token House": 32.33,
      "Citizen House": 34.59,
      "Grants Council": 10.15,
      "Grants Council (Milestone & Metrics Sub-committee)": 2.82,
      "Security Council": 12.78,
      "Code of Conduct Council": 4.32,
      "Developer Advisory Board": 3.01,
    },
  },
];

const CPILineGraph: React.FC<CPILineGraphProps> = ({
  cpiResults,
  initialCPI,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ChartJS | null>(null);
  const { setIsSaving } = useContext(SavingContext);

  // Function to capture chart as image
  const getChartImage = async (): Promise<string | null> => {
    if (chartContainerRef.current) {
      try {
        const canvas = await html2canvas(chartContainerRef.current, {
          backgroundColor: "white",
          scale: 2, // Increase quality
          logging: false,
        });
        return canvas.toDataURL("image/png");
      } catch (error) {
        console.error("Error capturing chart:", error);
        return null;
      }
    }
    return null;
  };

  const base64ToFile = (base64: string, filename: string): File => {
    const parts = base64.split(";base64,");
    const contentType = parts[0].split(":")[1];
    const raw = window.atob(parts[1]);
    const rawLength = raw.length;
    const uInt8Array = new Uint8Array(rawLength);

    for (let i = 0; i < rawLength; ++i) {
      uInt8Array[i] = raw.charCodeAt(i);
    }

    const blob = new Blob([uInt8Array], { type: contentType });
    return new File([blob], filename, { type: contentType });
  };

  // Function to upload chart image to Lighthouse
  const uploadChartToLighthouse = async (): Promise<UploadResponse> => {
    try {
      // Get the chart image
      const chartImage = await getChartImage();

      if (!chartImage) {
        throw new Error("Failed to capture chart image");
      }

      // Convert base64 to File
      const imageFile = base64ToFile(chartImage, "chart.png");

      // Upload using lighthouse.upload
      const output = await lighthouse.upload(
        [imageFile],
        "67bf3ae8.c57ead6e6cb24c29b7ac6e846466fee4"
      );
      console.log("File Status:", output.data.Hash);
      return {
        success: true,
        status: output,
        imageUrl: output.data.Hash, // Adjust based on actual response structure
      };
    } catch (error) {
      console.error("Error uploading to Lighthouse:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  };

  // Updated handleShareToTwitter function
  const handleShareToTwitter = async () => {
    setIsSaving(true);

    try {
      const result = await uploadChartToLighthouse();

      if (!result.success || !result.imageUrl) {
        throw new Error("Failed to upload chart image to Lighthouse");
      }
  
      const imageUrl = `https://files.lighthouse.storage/viewFile/${result.imageUrl}`;
      const tweetText = encodeURIComponent(
        `Here's my take on the Concentration of Power Index (CPI) in the Optimism Collective! I adjusted the influence of each HCC based on my understanding.\nCheck it out: ${imageUrl}\n\nYou have a better idea? Try it yourself and share your graph here: https://www.daocpi.com/`
      );
      const twitterIntentUrl = `https://twitter.com/intent/tweet?text=${tweetText}`;

       window.open(twitterIntentUrl, '_blank')
    } catch (error) {
      console.error("Error sharing to Twitter:", error);
      alert("Failed to share to Twitter. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Function to download image
  const handleDownloadChart = async () => {
    setIsSaving(true);

    const imageData = await getChartImage();
    if (imageData) {
      const link = document.createElement("a");
      link.download = "cpi-chart.png";
      link.href = imageData;
      link.click();
    }
    setIsSaving(false);
  };

  const handleNativeShare = async () => {
    setIsSaving(true);

    try {
      const imageData = await getChartImage();
      if (!imageData) return;

      // Convert base64 to blob
      const response = await fetch(imageData);
      const blob = await response.blob();
      const file = new File([blob], "chart.png", { type: "image/png" });

      const text =
        "Here's the latest CPI analysis chart with insights on recent council distributions!";

      if (navigator.share) {
        await navigator.share({
          title: "CPI Analysis Chart",
          text,
          files: [file],
        });
      } else {
        // Fallback to download
        handleDownloadChart();
      }
    } catch (error) {
      console.error("Error sharing:", error);
      // Fallback to download
      handleDownloadChart();
    }
    setIsSaving(false);
  };

  // Event data
  const events: Event[] = [
    // {
    //   name: "RPGF Round 2",
    //   startDate: "2022-05-26",
    //   endDate: "2023-03-30",
    //   color: "rgba(255,0,0,0.7)",
    // },
    // {
    //   name: "RPGF Round 3",
    //   startDate: "2023-03-31",
    //   endDate: "2024-01-11",
    //   color: "rgba(255,0,0,0.7)",
    // },
    {
      name: "RPGF Round 4",
      startDate: "2024-01-12",
      endDate: "2024-07-16",
      color: "rgba(255,0,0,0.7)",
    },
    {
      name: "RPGF Round 5",
      startDate: "2024-07-17",
      endDate: "2024-10-21",
      color: "rgba(255,0,0,0.7)",
    },
    {
      name: "RPGF Round 6",
      startDate: "2024-10-22",
      endDate: "2024-12-31",
      color: "rgba(255,0,0,0.7)",
    },
    // {
    //   name: "Season 3",
    //   startDate: "2023-01-26",
    //   endDate: "2023-06-07",
    //   color: "rgba(128,0,128,0.7)",
    // },
    // {
    //   name: "Season 4",
    //   startDate: "2023-06-08",
    //   endDate: "2024-01-03",
    //   color: "rgba(128,0,128,0.7)",
    // },
    {
      name: "Season 5",
      startDate: "2024-01-04",
      endDate: "2024-06-26",
      color: "rgba(128,0,128,0.7)",
    },
    {
      name: "Season 6",
      startDate: "2024-06-27",
      endDate: "2024-12-31",
      color: "rgba(128,0,128,0.7)",
    },
  ];

  // Format dates from filenames to standardized ISO format
  const formatDate = (filename: string) => {
    if (!filename || typeof filename !== "string") {
      console.warn("Invalid filename received:", filename);
      return "";
    }

    const dateStr = filename.replace(".csv", "");

    // Handle both MM-DD-YYYY and YYYY-MM-DD formats
    if (dateStr.includes("-")) {
      const parts = dateStr.split("-");
      if (parts[0].length === 4) {
        // YYYY-MM-DD format - use the date string directly
        return dateStr;
      } else {
        // MM-DD-YYYY format - construct ISO string
        const month = parts[0].padStart(2, "0");
        const day = parts[1].padStart(2, "0");
        const year = parts[2];
        return `${year}-${month}-${day}`;
      }
    }
    return dateStr; // Return as is if no dashes found
  };

  // Get all unique dates from both datasets and sort chronologically
  const allDates = Array.from(
    new Set([
      ...initialCPI.map((item) => formatDate(item.filename)),
      ...cpiResults.map((item) => formatDate(item.filename)),
    ])
  )
    .filter(Boolean)
    .sort();

  const formatDisplayDate = (dateStr: string) => {
    try {
      if (!dateStr || typeof dateStr !== "string") {
        // console.warn('Invalid date string received:', dateStr);
        return "";
      }

      // Create date object in UTC
      const date = new Date(dateStr + "T00:00:00Z");

      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.warn("Invalid date created from:", dateStr);
        return dateStr;
      }

      return date.toLocaleDateString("en-US", {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
        timeZone: "UTC",
      });
    } catch (error) {
      console.error("Error formatting date:", error);
      return dateStr;
    }
  };

  // Prepare annotations for events
  const annotations: { [key: string]: any } = {};
  events.forEach((event, index) => {
    const isRPGF = event.name.includes("RPGF");
    const yPosition = isRPGF ? "8%" : "12%";

    annotations[`eventLine${index}`] = {
      type: "line",
      xMin: event.startDate,
      xMax: event.startDate,
      borderColor: event.color,
      borderWidth: 1,
      borderDash: [6, 6],
    };
    annotations[`eventLabel${index}`] = {
      type: "label",
      xValue: event.startDate,
      yValue: yPosition,
      content: event.name,
      font: {
        size: 12,
        weight: "bold",
      },
      color: event.color,
      textAlign: "center",
      xAdjust: isRPGF ? 55 : 40,
      yAdjust: isRPGF ? -20 : 20,
    };
  });

  const data = {
    labels: allDates,
    datasets: [
      {
        label: "Historical CPI",
        data: allDates.map((date) => {
          const result = initialCPI.find(
            (r) => formatDate(r.filename) === date
          );
          return result ? result.cpi : null;
        }),
        borderColor: "rgb(75, 192, 192)",
        fill: false,
        tension: 0.4,
        spanGaps: true,
        pointRadius: 4,
        pointBackgroundColor: "#fff",
        pointHoverRadius: 5,
        order: 2,
      },
      {
        label: "Simulated CPI",
        data: allDates.map((date) => {
          const result = cpiResults.find(
            (r) => formatDate(r.filename) === date
          );
          return result ? result.cpi : null;
        }),
        borderColor: "rgb(255, 99, 132)",
        fill: false,
        tension: 0.4,
        spanGaps: true,
        pointRadius: 4,
        pointBackgroundColor: "#fff",
        pointHoverRadius: 5,
        order: 1,
      },
    ],
  };

  const options: ChartOptions<"line"> = {
    plugins: {
      legend: {
        position: "top" as const,
        labels: {
          font: {
            family: "Inter",
            size: 12,
          },
          usePointStyle: true,
          padding: 20,
        },
      },
      annotation: {
        annotations: annotations,
      },
      tooltip: {
        mode: "index",
        intersect: false,
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        padding: 12,
        titleFont: {
          size: 14,
          weight: "bold",
        },
        bodyFont: {
          size: 13,
        },
        callbacks: {
          title: (context) => {
            return formatDisplayDate(context[0].label);
          },
          label: (context) => {
            const date = context.label;
            const historicalData = initialCPI.find(
              (r) => formatDate(r.filename) === date
            );
            const simulatedData = cpiResults.find(
              (r) => formatDate(r.filename) === date
            );

            const lines = [
              `${context.dataset.label}: ${context.parsed.y.toFixed(2)}`,
            ];

            // Only process for the dataset that has data
            if (context.parsed.y !== null) {
              // For Simulated CPI percentages
              if (
                context.datasetIndex === 1 &&
                simulatedData?.activeRedistributed
              ) {
                lines.push("Simulated Council Percentages:");
                Object.entries(simulatedData.activeRedistributed).forEach(
                  ([council, value]) => {
                    if (value !== undefined) {
                      lines.push(`  ${council}: ${value.toFixed(2)}%`);
                    }
                  }
                );
              }
            }

            if (
              context.datasetIndex ===
              context.chart.data.datasets.length - 1
            ) {
              lines.push("");
            }

            // For Historical CPI percentages
            if (context.datasetIndex === 0 && historicalData) {
              const currentDate = new Date(date);
              const applicablePercentages = HISTORICAL_PERCENTAGES.find(
                (period) =>
                  new Date(period.start_date) <= currentDate &&
                  new Date(period.end_date) >= currentDate
              );

              if (applicablePercentages) {
                lines.push("Active Councils:");
                Object.entries(applicablePercentages.percentages).forEach(
                  ([council, percentage]) => {
                    lines.push(`  ${council}: ${percentage.toFixed(2)}%`);
                  }
                );
              }
            }
            return lines;
          },

          labelTextColor: (context) => {
            return context.dataset.borderColor as string;
          },
        },
      },
    },
    scales: {
      x: {
        type: "time",
        time: {
          unit: "day",
          tooltipFormat: "yyyy-MM-dd",
          displayFormats: { day: "MMM yyyy" },
        },
        ticks: { autoSkip: true, maxTicksLimit: 10 },
      },
      y: {
        title: {
          display: true,
          text: "CPI Value",
          font: {
            size: 14,
            weight: "bold",
          },
        },
        ticks: {
          precision: 4,
          callback: function (value) {
            return Number(value).toFixed(2);
          },
        },
        grid: {
          display: true,
          color: "rgba(0, 0, 0, 0.1)",
        },
      },
    },
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "nearest",
      axis: "x",
      intersect: false,
    },
    animation: {
      duration: 1000,
      easing: "easeInOutQuart",
    },
  };

  return (
    <div className="w-full bg-white rounded-lg shadow-lg p-6">
      <div className="flex justify-end gap-2 mb-4">
        <button
          onClick={handleDownloadChart}
          className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          title="Download Chart"
        >
          <BsDownload size={20} className="text-gray-700" />
        </button>
        <button
          onClick={handleShareToTwitter}
          className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          title="Share on Twitter"
        >
          <BsTwitterX size={20} className="text-black" />
        </button>
        <button
          onClick={handleNativeShare}
          className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          title="Share"
        >
          <BsShare size={20} className="text-gray-700" />
        </button>
      </div>

      <div ref={chartContainerRef} className="h-[500px]">
        <Line
          data={data}
          options={options}
          ref={(ref) => {
            if (ref) {
              chartRef.current = ref;
            }
          }}
        />
      </div>
    </div>
  );
};

export default memo(CPILineGraph);
