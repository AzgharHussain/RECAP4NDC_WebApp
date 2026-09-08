import React, { useState, useEffect, useMemo } from "react";
import { Table, Button, Input, Select, DatePicker, Modal, Tag, Space, Card, Row, Col, Statistic } from "antd";
import { SearchOutlined, EyeOutlined, ExclamationCircleOutlined, FireOutlined, EnvironmentOutlined, UserOutlined } from "@ant-design/icons";
import "./PatrolIncidentLogs.css";
import exportIcon from "../assets/excel.png";
import noDataImage from "../assets/no-data.png";
import { useLanguage } from "../context/LanguageContext";
import { API_BASE_URL } from "../config";

const { Option } = Select;

const IncidentLogs = () => {
  const [incidentData, setIncidentData] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);
  const [loading, setLoading] = useState(false);

  const { language } = useLanguage();

  const text = {
    en: {
      title: "Incident Logs",
      searchPlaceholder: "Search by user, type, description...",
      categoryFilterPlaceholder: "All Categories",
      dateFilterPlaceholder: "Filter by date",
      exportButton: "Export",
      noDataText: "No incident logs available",
      incidentId: "Incident ID",
      username: "Username",
      incidentType: "Incident Type",
      category: "Category",
      subcategory: "Subcategory",
      incidentDate: "Date",
      incidentTime: "Time",
      description: "Description",
      images: "Images",
      view: "View",
      viewImages: "View Images",
      totalIncidents: "Total Incidents",
      categories: "Categories",
      withImages: "With Images",
      clearFilters: "Clear Filters",
    },
    gu: {
      title: "ઘટના લોગ્સ",
      searchPlaceholder: "વપરાશકર્તા, પ્રકાર, વર્ણન દ્વારા શોધો...",
      categoryFilterPlaceholder: "બધી શ્રેણીઓ",
      dateFilterPlaceholder: "તારીખ દ્વારા ફિલ્ટર",
      exportButton: "નિકાસ",
      noDataText: "કોઈ ઘટના લોગ્સ ઉપલબ્ધ નથી",
      incidentId: "ઘટના ID",
      username: "વપરાશકર્તા નામ",
      incidentType: "ઘટના પ્રકાર",
      category: "શ્રેણી",
      subcategory: "ઉપશ્રેણી",
      incidentDate: "તારીખ",
      incidentTime: "સમય",
      description: "વર્ણન",
      images: "છબીઓ",
      view: "જુઓ",
      viewImages: "છબીઓ જુઓ",
      totalIncidents: "કુલ ઘટનાઓ",
      categories: "શ્રેણીઓ",
      withImages: "છબીઓ સાથે",
      clearFilters: "ફિલ્ટર સાફ કરો",
    },
  };

  // Fetch incident categories for dropdown
  const fetchCategories = async () => {
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("authToken");
      const response = await fetch(`${API_BASE_URL}/api/incident-categories/flat`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return;
      const data = await response.json();
      if (data.success && Array.isArray(data.data)) {
        setCategories(data.data);
      }
    } catch (err) {
      console.error("Error fetching categories:", err);
    }
  };

  // Fetch all incident logs
  const fetchIncidentLogs = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("authToken");
      const response = await fetch(`${API_BASE_URL}/api/incident-logs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();

      let formatted = Array.isArray(data.data) ? data.data : [];
      formatted = formatted.map((item, index) => ({
        key: item.incident_id || `incident-${index}`,
        ...item,
      }));

      setIncidentData(formatted);
    } catch (error) {
      console.error("Error fetching incident logs:", error);
      setIncidentData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
    const timer = setTimeout(() => fetchIncidentLogs(), 100);
    return () => clearTimeout(timer);
  }, []);

  // Apply filters
  useEffect(() => {
    let data = [...incidentData];

    if (searchText.trim() !== "") {
      const lower = searchText.toLowerCase();
      data = data.filter((item) =>
        (item.username || "").toLowerCase().includes(lower) ||
        (item.incident_type || "").toLowerCase().includes(lower) ||
        (item.category_name || "").toLowerCase().includes(lower) ||
        (item.incident_subcategory || "").toLowerCase().includes(lower) ||
        (item.description || "").toLowerCase().includes(lower)
      );
    }

    if (categoryFilter !== "All") {
      data = data.filter((item) => String(item.incident_category_id) === String(categoryFilter));
    }

    if (dateFilter) {
      const selected = dateFilter.format("YYYY-MM-DD");
      data = data.filter((item) => item.incident_date === selected);
    }

    setFilteredData(data);
  }, [searchText, categoryFilter, dateFilter, incidentData]);

  const handleClearFilters = () => {
    setSearchText("");
    setCategoryFilter("All");
    setDateFilter(null);
  };

  const formatDisplayDate = (dateStr) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const handleExport = async () => {
    if (!filteredData.length) {
      alert(text[language].noDataText);
      return;
    }

    window.dispatchEvent(new CustomEvent('global-data-loading-start', { detail: { message: 'Data is exporting...' } }));
    try {
      const [XLSX, { saveAs }] = await Promise.all([
        import("xlsx"),
        import("file-saver"),
      ]);

      const exportData = filteredData.map((item) => ({
        [text[language].incidentId]: item.incident_id,
        [text[language].username]: item.username || "-",
        [text[language].incidentType]: item.incident_type || "-",
        [text[language].category]: item.category_name || "-",
        [text[language].subcategory]: item.incident_subcategory || "-",
        [text[language].incidentDate]: formatDisplayDate(item.incident_date),
        [text[language].incidentTime]: item.incident_time || "-",
        [text[language].description]: item.description || "-",
        [text[language].images]: (item.incident_image || []).length,
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Incident Logs");

      const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      saveAs(
        new Blob([wbout], { type: "application/octet-stream" }),
        "Incident_Logs.xlsx"
      );
    } finally {
      window.dispatchEvent(new Event('global-data-loading-end'));
    }
  };

  const showModal = (images) => {
    setSelectedImages(images || []);
    setIsModalVisible(true);
  };

  const handleCancel = () => {
    setIsModalVisible(false);
  };

  const columns = [
    {
      title: text[language].incidentId,
      dataIndex: "incident_id",
      key: "incident_id",
      sorter: (a, b) => a.incident_id - b.incident_id,
      align: "center",
      width: 90,
    },
    {
      title: text[language].username,
      dataIndex: "username",
      key: "username",
      sorter: (a, b) => (a.username || "").localeCompare(b.username || ""),
      align: "center",
      render: (val) => val || "-",
    },
    {
      title: text[language].incidentType,
      dataIndex: "incident_type",
      key: "incident_type",
      sorter: (a, b) => (a.incident_type || "").localeCompare(b.incident_type || ""),
      align: "center",
      render: (val) => <Tag color="orange">{val || "-"}</Tag>,
    },
    {
      title: text[language].category,
      dataIndex: "category_name",
      key: "category_name",
      sorter: (a, b) => (a.category_name || "").localeCompare(b.category_name || ""),
      align: "center",
      render: (val) => val ? <Tag color="green">{val}</Tag> : "-",
    },
    {
      title: text[language].subcategory,
      dataIndex: "incident_subcategory",
      key: "incident_subcategory",
      sorter: (a, b) => (a.incident_subcategory || "").localeCompare(b.incident_subcategory || ""),
      align: "center",
      render: (val) => val || "-",
    },
    {
      title: text[language].incidentDate,
      dataIndex: "incident_date",
      key: "incident_date",
      sorter: (a, b) => new Date(a.incident_date) - new Date(b.incident_date),
      align: "center",
      render: (val) => formatDisplayDate(val),
    },
    {
      title: text[language].incidentTime,
      dataIndex: "incident_time",
      key: "incident_time",
      sorter: (a, b) => (a.incident_time || "").localeCompare(b.incident_time || ""),
      align: "center",
      render: (val) => val ? val.substring(0, 5) : "-",
    },
    {
      title: text[language].description,
      dataIndex: "description",
      key: "description",
      sorter: (a, b) => (a.description || "").localeCompare(b.description || ""),
      render: (val) => {
        if (!val) return "-";
        return val.length > 60 ? `${val.substring(0, 60)}...` : val;
      },
    },
    {
      title: text[language].images,
      dataIndex: "incident_image",
      key: "incident_image",
      align: "center",
      width: 100,
      render: (images) => {
        const count = (images || []).length;
        if (count === 0) return "-";
        return (
          <Button
            style={{
              borderRadius: "4px",
              border: "1px solid rgba(255, 255, 255, 0.23)",
              background: "rgba(116, 190, 0, 0.40)",
              color: "#000",
            }}
            icon={<EyeOutlined />}
            onClick={() => showModal(images.map((img) => `data:${img.image_type};base64,${img.image_data}`))}
          >
            {text[language].view} ({count})
          </Button>
        );
      },
    },
  ];

  // Quick stats
  const stats = useMemo(() => {
    const total = filteredData.length;
    const catSet = new Set(filteredData.filter(i => i.category_name).map(i => i.category_name));
    const withImages = filteredData.filter(i => (i.incident_image || []).length > 0).length;
    return { total, categories: catSet.size, withImages };
  }, [filteredData]);

  return (
    <div className="patrol-logs-page">
      <div className="section patrol-logs-section">
        <h3 className="main-heading">{text[language].title}</h3>

        {/* Quick stats */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={8}>
            <Card size="small" className="patrol-insight-card" style={{ minHeight: 70 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <ExclamationCircleOutlined style={{ fontSize: 28, color: "#d97706" }} />
                <div>
                  <div style={{ fontSize: 11, color: "#496153", fontWeight: 700 }}>{text[language].totalIncidents}</div>
                  <div style={{ fontSize: 20, color: "#0f6b3f", fontWeight: 800 }}>{stats.total}</div>
                </div>
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card size="small" className="patrol-insight-card" style={{ minHeight: 70 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <FireOutlined style={{ fontSize: 28, color: "#dc2626" }} />
                <div>
                  <div style={{ fontSize: 11, color: "#496153", fontWeight: 700 }}>{text[language].categories}</div>
                  <div style={{ fontSize: 20, color: "#0f6b3f", fontWeight: 800 }}>{stats.categories}</div>
                </div>
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card size="small" className="patrol-insight-card" style={{ minHeight: 70 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <EyeOutlined style={{ fontSize: 28, color: "#2563eb" }} />
                <div>
                  <div style={{ fontSize: 11, color: "#496153", fontWeight: 700 }}>{text[language].withImages}</div>
                  <div style={{ fontSize: 20, color: "#0f6b3f", fontWeight: 800 }}>{stats.withImages}</div>
                </div>
              </div>
            </Card>
          </Col>
        </Row>

        {/* Filter card */}
        <div className="patrol-filter-card">
          <Input
            placeholder={text[language].searchPlaceholder}
            prefix={<SearchOutlined style={{ color: "rgba(0, 0, 0, 0.25)" }} />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
          />
          <Select
            value={categoryFilter}
            onChange={(val) => setCategoryFilter(val)}
            style={{ width: "100%" }}
          >
            <Option value="All">{text[language].categoryFilterPlaceholder}</Option>
            {categories.map((cat) => (
              <Option key={cat.category_id} value={String(cat.category_id)}>
                {cat.category_name}
              </Option>
            ))}
          </Select>
          <DatePicker
            placeholder={text[language].dateFilterPlaceholder}
            value={dateFilter}
            onChange={(val) => setDateFilter(val)}
            format="DD-MM-YYYY"
            style={{ width: "100%" }}
          />
          <Space>
            <Button onClick={handleClearFilters} style={{ borderRadius: 8 }}>
              {text[language].clearFilters}
            </Button>
            <Button className="btn-Export" onClick={handleExport} style={{ borderRadius: 8, display: "flex", alignItems: "center", gap: 8 }}>
              {text[language].exportButton}
              <img src={exportIcon} alt="Export" className="btn-icon" />
            </Button>
          </Space>
        </div>

        {/* Table */}
        <div className="patrol-table-card">
          <Table
            className="transparent-table patrol-modern-table"
            columns={columns}
            dataSource={filteredData}
            loading={loading}
            pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `${total} ${language === "gu" ? "પરિણામો" : "results"}` }}
            bordered
            scroll={{ x: "max-content" }}
            rowKey={(record) => record.key || record.incident_id}
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
        </div>
      </div>

      {/* Image modal */}
      <Modal
        open={isModalVisible}
        onCancel={handleCancel}
        footer={null}
        width={800}
        title={text[language].viewImages}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
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

export default IncidentLogs;
