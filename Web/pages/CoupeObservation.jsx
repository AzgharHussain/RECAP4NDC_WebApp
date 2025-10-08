import React, { useState, useEffect } from "react";
import { Table, Button, Input, Select, DatePicker, Modal } from "antd";
import { SearchOutlined, EyeOutlined } from "@ant-design/icons";
import exportIcon from "../assets/excel.png";
import noDataImage from "../assets/no-data.png";
import dayjs from "dayjs"; // For date formatting
import * as XLSX from "xlsx"; // Import xlsx
import { saveAs } from "file-saver"; // Import file-saver

const { Option } = Select;

const CoupeObservation = () => {
  const [filteredData, setFilteredData] = useState([]);
  const [searchOfficer, setSearchOfficer] = useState("");
  const [selectedIssueType, setSelectedIssueType] = useState("All");
  const [selectedDate, setSelectedDate] = useState(null);
  const [originalData, setOriginalData] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);

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
      title: "Serial No.",
      dataIndex: "p_log_id",
      key: "p_log_id",
      sorter: (a, b) => a.p_log_id - b.p_log_id, // numeric sort
    },
    {
      title: "Issue ID",
      dataIndex: "p_issue_id",
      key: "p_issue_id",
      sorter: (a, b) => a.p_issue_id.localeCompare(b.p_issue_id), // string sort
    },
    {
      title: "Officer Name",
      dataIndex: "p_officer_name",
      key: "p_officer_name",
      sorter: (a, b) => a.p_officer_name.localeCompare(b.p_officer_name), // string sort
    },
    {
      title: "Submitted Date",
      dataIndex: "p_date_time",
      key: "submitted_date",
      render: (text) => formatDateTime(text).date,
      align: "center",
      sorter: (a, b) =>
        new Date(a.p_date_time).getTime() - new Date(b.p_date_time).getTime(),
    },
    {
      title: "Submitted Time",
      dataIndex: "p_date_time",
      key: "submitted_time",
      render: (text) => formatDateTime(text).time,
      align: "center",
      sorter: (a, b) =>
        new Date(a.p_date_time).getTime() - new Date(b.p_date_time).getTime(),
    },
    {
      title: "Issue Type",
      dataIndex: "p_issue_type",
      key: "p_issue_type",
      sorter: (a, b) => a.p_issue_type.localeCompare(b.p_issue_type),
    },
    {
      title: "Observation Notes",
      dataIndex: "p_observation_notes",
      key: "p_observation_notes",
      sorter: (a, b) =>
        (a.p_observation_notes || "").localeCompare(
          b.p_observation_notes || ""
        ),
    },
    {
      title: "Images",
      dataIndex: "p_image_urls",
      key: "p_image_urls",
      render: (images) => (
        <Button
          icon={<EyeOutlined />}
          onClick={() => showModal(images)}
          style={{ border: "none", backgroundColor: "transparent" }}
        />
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
      alert("No data to export");
      return;
    }

    // Format the filtered data to match the columns you want in the export
    const exportData = filteredData.map((item) => ({
      "Serial No.": item.p_log_id,
      "Issue ID": item.p_issue_id,
      "Officer Name": item.p_officer_name,
      "Submitted Date": formatDateTime(item.p_date_time).date,
      "Submitted Time": formatDateTime(item.p_date_time).time,
      "Issue Type": item.p_issue_type,
      "Observation Notes": item.p_observation_notes,
      Images: item.p_image_urls.join(", "), // Join image URLs if needed
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
        <h3 className="main-heading">
          Working Plan Areas (Coupe Observation Log)
        </h3>

        {/* Filters Section */}
        <div className="filters-section">
          <Input
            placeholder="Search by Officer Name"
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
            styles={{
              popup: {
                root: {
                  backgroundColor: "rgba(255, 255, 255, 0.2)", // Background color of the dropdown
                  color: "#fff", // Color for dropdown items
                },
              },
            }}
          >
            <Option value="All">All Issue Types</Option>
            <Option value="Invasive Species">Invasive Species</Option>
            <Option value="Illegal Logging">Illegal Logging</Option>
            <Option value="Tree Disease">Tree Disease</Option>
          </Select>

          <DatePicker
            placeholder="Select To Date"
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
            Export
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
                No data available
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
        title="View Images"
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
