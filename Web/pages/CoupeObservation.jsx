import React, { useState, useEffect } from "react";
import { Table, Button, Input, Select, DatePicker, Modal } from "antd";
import { SearchOutlined, EyeOutlined } from "@ant-design/icons";
import exportIcon from "../assets/excel.png";
import noDataImage from "../assets/no-data.png";
import dayjs from "dayjs"; // For date formatting
import * as XLSX from "xlsx"; // Import xlsx
import { saveAs } from "file-saver"; // Import file-saverz
import { useLanguage } from "../context/LanguageContext"; // Import language context

const { Option } = Select;

const CoupeObservation = () => {
  const [filteredData, setFilteredData] = useState([]);
  const [searchOfficer, setSearchOfficer] = useState("");
  const [selectedIssueType, setSelectedIssueType] = useState("All");
  const [selectedDate, setSelectedDate] = useState(null);
  const [originalData, setOriginalData] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);

  const { language } = useLanguage(); // Use the language context

  // Define text for English and Gujarati
  const text = {
    en: {
      title: "Working Plan Areas (Coupe Observation Log)",
      searchPlaceholder: "Search by Officer Name",
      issueTypePlaceholder: "Select Issue Type",
      datePickerPlaceholder: "Select To Date",
      exportButton: "Export",
      noDataText: "No data available",
      serialNo: "Serial No.",
      issueId: "Issue ID",
      officerName: "Officer Name",
      submittedDate: "Submitted Date",
      submittedTime: "Submitted Time",
      issueType: "Issue Type",
      observationNotes: "Observation Notes",
      images: "Images",
      viewImages: "View Images",
      allIssueTypes: "All Issue Types",
      invasiveSpecies: "Invasive Species",
      illegalLogging: "Illegal Logging",
      treeDisease: "Tree Disease",
    },
    gu: {
      title: "કાર્ય યોજના ક્ષેત્રો (કોપ ઓબઝર્વેશન લોગ)",
      searchPlaceholder: "કર્મચારી નામ દ્વારા શોધો",
      issueTypePlaceholder: "સમસ્યા પ્રકાર પસંદ કરો",
      datePickerPlaceholder: "તારીખ પસંદ કરો",
      exportButton: "નિકાલ",
      noDataText: "કોઈ માહિતી ઉપલબ્ધ નથી",
      serialNo: "ક્રમ નંબર",
      issueId: "સમસ્યા ID",
      officerName: "કર્મચારીનું નામ",
      submittedDate: "સબમિટ થયેલી તારીખ",
      submittedTime: "સબમિટ થયેલો સમય",
      issueType: "સમસ્યા પ્રકાર",
      observationNotes: "પરિક્ષણ નોંધો",
      images: "ચિત્રો",
      viewImages: "ચિત્રો જુઓ",
      allIssueTypes: "બધા સમસ્યાના પ્રકાર",
      invasiveSpecies: "આક્રમક પ્રજાતિઓ",
      illegalLogging: "અકાયદેસર લોગિંગ",
      treeDisease: "વૃક્ષ બિમારી",
    },
  };

  // Fetch data from the API
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(
          "http://68.178.167.39:5000/api/coupe/log-with-images?user_id=2"
        );
        const result = await response.json();
        if (result && Array.isArray(result)) {
          setOriginalData(result); // Store the original unfiltered data
          setFilteredData(result); // Initialize filtered data
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();
  }, []);

  // Apply filters to the original data
  const applyFilters = () => {
    let data = [...originalData]; // Start with the original data

    // Filter by officer name
    if (searchOfficer.trim() !== "") {
      const lowerSearch = searchOfficer.toLowerCase();
      data = data.filter((item) =>
        item.p_officer_name?.toLowerCase().includes(lowerSearch)
      );
    }

    // Filter by issue type
    if (selectedIssueType !== "All") {
      data = data.filter((item) => item.p_issue_type === selectedIssueType);
    }

    // Filter by selected date
    if (selectedDate) {
      data = data.filter((item) =>
        dayjs(item.p_date_time).isSame(selectedDate, "day")
      );
    }

    // Update filtered data
    setFilteredData(data);
  };

  // Handle the filter input changes
  const handleSearchOfficerChange = (e) => {
    setSearchOfficer(e.target.value);
  };

  const handleIssueTypeChange = (value) => {
    setSelectedIssueType(value);
  };

  const handleDateChange = (date, dateString) => {
    setSelectedDate(dateString ? dayjs(dateString) : null); // Format the date
  };

  // Reapply filters when any of the filter values change
  useEffect(() => {
    applyFilters(); // Call applyFilters whenever the filter values change
  }, [searchOfficer, selectedIssueType, selectedDate, originalData]); // Dependencies to trigger re-filtering

  const formatDateTime = (datetime) => {
    const date = new Date(datetime);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return { date: `${day}-${month}-${year}`, time: `${hours}:${minutes}` };
  };

  const columns = [
    {
      title: text[language].serialNo,
      dataIndex: "p_log_id",
      key: "p_log_id",
      sorter: (a, b) => a.p_log_id - b.p_log_id, // numeric sort
    },
    {
      title: text[language].issueId,
      dataIndex: "p_issue_id",
      key: "p_issue_id",
      sorter: (a, b) => a.p_issue_id.localeCompare(b.p_issue_id), // string sort
    },
    {
      title: text[language].officerName,
      dataIndex: "p_officer_name",
      key: "p_officer_name",
      sorter: (a, b) => a.p_officer_name.localeCompare(b.p_officer_name), // string sort
    },
    {
      title: text[language].submittedDate,
      dataIndex: "p_date_time",
      key: "submitted_date",
      render: (text) => formatDateTime(text).date,
      align: "center",
      sorter: (a, b) =>
        new Date(a.p_date_time).getTime() - new Date(b.p_date_time).getTime(),
    },
    {
      title: text[language].submittedTime,
      dataIndex: "p_date_time",
      key: "submitted_time",
      render: (text) => formatDateTime(text).time,
      align: "center",
      sorter: (a, b) =>
        new Date(a.p_date_time).getTime() - new Date(b.p_date_time).getTime(),
    },
    {
      title: text[language].issueType,
      dataIndex: "p_issue_type",
      key: "p_issue_type",
      sorter: (a, b) => a.p_issue_type.localeCompare(b.p_issue_type),
    },
    {
      title: text[language].observationNotes,
      dataIndex: "p_observation_notes",
      key: "p_observation_notes",
      sorter: (a, b) =>
        (a.p_observation_notes || "").localeCompare(
          b.p_observation_notes || ""
        ),
    },
    {
      title: text[language].images,
      dataIndex: "p_image_urls",
      key: "p_image_urls",
      render: (images) => (
        // <Button
        //   icon={<EyeOutlined />}
        //   onClick={() => showModal(images)}
        //   style={{ border: "none", backgroundColor: "transparent" }}


        // />

         <Button
                          style={{
                            borderRadius: "4.618px",
                            border: "1.961px solid rgba(255, 255, 255, 0.23)",
                            background: "rgba(116, 190, 0, 0.40)",
                            color: "#000",
                          }}
                          icon={<EyeOutlined />}
                        onClick={() => showModal(images)}
                        >
                          {language === "gu" ? "દેખાવ" : "View"}
                        </Button>
      ),
    },
  ];

  // Open modal with images
  const showModal = (images) => {
    setSelectedImages(images);
    setIsModalVisible(true);
  };

  // Close the modal
  const handleCancel = () => {
    setIsModalVisible(false);
  };

  // Export data to Excel
  const handleExport = () => {
    if (filteredData.length === 0) {
      alert(text[language].noDataText);
      return;
    }

    // Format the filtered data to match the columns you want in the export
    const exportData = filteredData.map((item) => ({
      [text[language].serialNo]: item.p_log_id,
      [text[language].issueId]: item.p_issue_id,
      [text[language].officerName]: item.p_officer_name,
      [text[language].submittedDate]: formatDateTime(item.p_date_time).date,
      [text[language].submittedTime]: formatDateTime(item.p_date_time).time,
      [text[language].issueType]: item.p_issue_type,
      [text[language].observationNotes]: item.p_observation_notes,
      [text[language].images]: item.p_image_urls.join(", "), // Join image URLs if needed
    }));

    // Create a worksheet and book, then trigger download
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Coupe Observation Logs");

    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(
      new Blob([wbout], { type: "application/octet-stream" }),
      "Coupe_Observation_Logs.xlsx"
    );
  };

  return (
    <div style={{ borderRadius: "10px", padding: "-8px" }}>
      <div className="heading-container">
        <h3 className="main-heading">{text[language].title}</h3>

        {/* Filters Section */}
        <div className="filters-section">
          <Input
            placeholder={text[language].searchPlaceholder}
            value={searchOfficer}
            onChange={handleSearchOfficerChange}
            style={{
              width: "200px",
              background: "rgba(255, 255, 255, 0.2)",
              color: "#fff",
              border: "none",
            }}
            suffix={
              <SearchOutlined
                style={{ color: "rgba(0, 0, 0, 0.25)", fontSize: "16px" }}
              />
            }
          />

          <Select
            defaultValue="All"
            value={selectedIssueType}
            onChange={handleIssueTypeChange}
            style={{
              width: "200px",
              background: "rgba(255, 255, 255, 0.2)",
              color: "#fff", // Color for selected text
              border: "none",
            }}
          >
            <Option value="All">{text[language].allIssueTypes}</Option>
            <Option value="Invasive Species">{text[language].invasiveSpecies}</Option>
            <Option value="Illegal Logging">{text[language].illegalLogging}</Option>
            <Option value="Tree Disease">{text[language].treeDisease}</Option>
          </Select>

          <DatePicker
            placeholder={text[language].datePickerPlaceholder}
            value={selectedDate ? dayjs(selectedDate) : null}
            onChange={handleDateChange}
            style={{
              width: "200px",
              color: "#fff",
              border: "2.21px solid rgba(255, 255, 255, 0.23)",
              background: "rgba(255, 255, 255, 0.02)",
            }}
          />

          <Button className="btn-Export" onClick={handleExport}>
            {text[language].exportButton}
            <img src={exportIcon} alt="Export Icon" className="btn-icon" />
          </Button>
        </div>
      </div>

      {/* Transparent Table */}
      <Table
        className="transparent-table"
        columns={columns}
        dataSource={filteredData}
        pagination={{ pageSize: 5 }}
        bordered
        rowKey={(record) => `${record.p_log_id}`} // Ensure unique key for each row
        locale={{
          emptyText: (
            <div style={{ textAlign: "center", padding: "50px 0" }}>
              <img
                src={noDataImage}
                alt="No Data"
                style={{ width: 60, marginBottom: 16 }}
              />
              <div style={{ fontSize: 16, color: "#000", fontWeight: 500 }}>
                {text[language].noDataText}
              </div>
            </div>
          ),
        }}
      />

      {/* Modal to display the images */}
      <Modal
        open={isModalVisible}
        onCancel={handleCancel}
        footer={null}
        width={800}
        title={text[language].viewImages}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          {selectedImages.map((image, index) => (
            <img
              key={index}
              src={image}
              alt={`Image ${index}`}
              style={{
                width: "100%",
                maxHeight: "500px",
                objectFit: "contain",
                marginBottom: "15px",
              }}
            />
          ))}
        </div>
      </Modal>
    </div>
  );
};

export default CoupeObservation;
