import React, { useEffect, useState } from "react";
import { Button, Card, Col, DatePicker, Descriptions, Image, Modal, Row, Select, Space, Statistic, Table, Tag, message } from "antd";
import { DownloadOutlined, EyeOutlined, EnvironmentOutlined, ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { API_BASE_URL } from "../config";
import { getAuthHeaders } from "../utils/authUtils";

const { RangePicker } = DatePicker;
const { Option } = Select;

const emptyOptions = { user_ids: [], villages: [], coupes: [], tables: [], divisions: [], months: [], statuses: ["Pending", "Resolved"] };

// Convert any timestamp to IST (UTC+5:30) and display as DD-MM-YYYY HH:mm:ss
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

const toIST = (value) => {
  if (!value) return null;
  // Try native Date first for ISO / Unix strings
  const d = new Date(value);
  if (!isNaN(d.getTime())) {
    const istDate = new Date(d.getTime() + IST_OFFSET_MS);
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(istDate.getUTCDate())}-${pad(istDate.getUTCMonth() + 1)}-${istDate.getUTCFullYear()} ${pad(istDate.getUTCHours())}:${pad(istDate.getUTCMinutes())}:${pad(istDate.getUTCSeconds())}`;
  }
  // Fallback: already a formatted string from the DB (e.g. "03-AUG-26 07:00:10")
  return String(value);
};

const formatSentAt = (value, _formattedValue) => {
  // Prefer the raw DB value so we can apply IST conversion accurately
  const result = toIST(value);
  return result || "-";
};

const NDVINotifications = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [monthlySummary, setMonthlySummary] = useState([]);
  const [options, setOptions] = useState(emptyOptions);
  const [summary, setSummary] = useState({ total_notifications: 0, users_received: 0, resolved: 0, pending: 0 });
  const [filters, setFilters] = useState({ user_id: null, table_name: null, division: null, month: null, status: null, dates: null });
  const [detailRecord, setDetailRecord] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailImageUrl, setDetailImageUrl] = useState(null);
  const [detailImageLoading, setDetailImageLoading] = useState(false);

  const fetchReport = async (overrideFilters = filters) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      ["user_id", "table_name", "division", "month", "status"].forEach((key) => {
        if (overrideFilters[key]) params.append(key, overrideFilters[key]);
      });
      if (overrideFilters.dates?.[0]) params.append("start_date", overrideFilters.dates[0].format("YYYY-MM-DD"));
      if (overrideFilters.dates?.[1]) params.append("end_date", overrideFilters.dates[1].format("YYYY-MM-DD"));

      const res = await fetch(`${API_BASE_URL}/api/ndvi-notification-report?${params.toString()}`, { headers: getAuthHeaders() });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to fetch notification report");
      console.table((json.data || []).map((item) => ({
        id: item.id,
        user_id: item.user_id,
        village_name: item.village_name,
        division: item.division,
        range: item.range,
        round: item.round,
        beat: item.beat,
        village: item.village,
        month: item.month,
        table_name: item.table_name,
        pixel_id: item.pixel_id,
        alert_status: item.alert_status,
        action_taken: item.action_taken,
        note: item.note,
        has_image: item.has_image,
        sent_at: item.sent_at,
        sent_at_raw: item.sent_at_raw,
        sent_at_formatted: item.sent_at_formatted,
        report_generated_at: item.report_generated_at,
      })));
      setData((json.data || []).map((item) => ({ ...item, key: item.id })));
      setMonthlySummary((json.monthlyDivisionSummary || []).map((item, index) => ({ ...item, key: `${item.month}-${item.division}-${index}` })));
      setSummary(json.summary || { total_notifications: 0, users_received: 0, resolved: 0, pending: 0 });
      setOptions({ ...emptyOptions, ...(json.options || {}) });
    } catch (err) {
      console.error(err);
      message.error(err.message || "Failed to fetch NDVI notifications");
      setData([]);
      setMonthlySummary([]);
      setSummary({ total_notifications: 0, users_received: 0, resolved: 0, pending: 0 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const clearFilters = () => {
    const cleared = { user_id: null, table_name: null, division: null, month: null, status: null, dates: null };
    setFilters(cleared);
    fetchReport(cleared);
  };

  const renderSelect = (key, placeholder, values, span = 4) => (
    <Col xs={24} md={8} lg={span}>
      <Select
        allowClear
        showSearch
        placeholder={placeholder}
        value={filters[key]}
        onChange={(value) => setFilters((prev) => ({ ...prev, [key]: value }))}
        style={{ width: "100%" }}
        optionFilterProp="children"
      >
        {(values || []).map((value) => <Option key={value} value={value}>{value}</Option>)}
      </Select>
    </Col>
  );

  const exportToExcel = async () => {
    if (!data.length) {
      message.warning("No notification data available to export");
      return;
    }

    const [XLSX, { saveAs }] = await Promise.all([import("xlsx"), import("file-saver")]);
    const rows = data.map((item, index) => ({
      "Sr. No.": index + 1,
      "User ID": item.user_id || "-",
      "Subscribed Village": item.village_name || "-",
      Division: item.division || "-",
      Range: item.range || "-",
      Round: item.round || "-",
      Beat: item.beat || "-",
      "Alert Village": item.village || item.village_name || "-",
      Month: item.month || "-",
      "Pixel ID": item.pixel_id || "-",
      Status: item.alert_status || "Pending",
      "Action Taken": item.action_taken || "No action taken",
      Note: item.note || "-",
      "Has Image": item.has_image ? "Yes" : "No",
      "Sent At (IST)": formatSentAt(item.sent_at, item.sent_at_formatted),
      "Report Generated At": item.report_generated_at || "-",
    }));
    const summaryRows = monthlySummary.map((item) => ({
      Month: item.month,
      Division: item.division,
      Range: item.range || "-",
      Round: item.round || "-",
      Beat: item.beat || "-",
      Village: item.village || "-",
      "Alerts Generated": item.alerts_generated,
      Resolved: item.resolved,
      Pending: item.pending,
    }));
    const filterRows = [
      { Filter: "User ID", Value: filters.user_id || "All" },
      { Filter: "Division", Value: filters.division || "All" },
      { Filter: "Month", Value: filters.month || "All" },
      { Filter: "Status", Value: filters.status || "All" },
      { Filter: "NDVI Table", Value: filters.table_name || "All" },
      { Filter: "Start Date", Value: filters.dates?.[0]?.format("YYYY-MM-DD") || "All" },
      { Filter: "End Date", Value: filters.dates?.[1]?.format("YYYY-MM-DD") || "All" },
      { Filter: "Users Received", Value: summary.users_received || 0 },
      { Filter: "Total Notifications", Value: summary.total_notifications || 0 },
      { Filter: "Resolved", Value: summary.resolved || 0 },
      { Filter: "Pending", Value: summary.pending || 0 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Notifications");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), "Monthly Summary");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filterRows), "Filters");
    const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([buffer], { type: "application/octet-stream" }), `ndvi_notifications_${dayjs().format("YYYYMMDD_HHmm")}.xlsx`);
  };

  const showDetails = async (record) => {
    setDetailRecord(record);
    setDetailModalOpen(true);
    setDetailImageUrl(null);
    if (record.has_image && record.table_name && record.pixel_id) {
      setDetailImageLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/api/ndvi-change`, {
          method: "GET",
          headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ NdvicoupeName: record.table_name, id: record.pixel_id }),
        });
        const json = await res.json();
        if (json.success && json.data && json.data[0] && json.data[0].image_data) {
          setDetailImageUrl(`data:${json.data[0].image_type || "image/jpeg"};base64,${json.data[0].image_data}`);
        }
      } catch (err) {
        console.error("Failed to fetch image:", err);
      } finally {
        setDetailImageLoading(false);
      }
    }
  };

  const openInGoogleMaps = (lat, lng) => {
    if (lat && lng) {
      window.open(`https://www.google.com/maps?q=${lat},${lng}`, "_blank");
    } else {
      message.warning("Location coordinates not available");
    }
  };

  const columns = [
    { title: "User ID", dataIndex: "user_id", key: "user_id" },
    { title: "Subscribed Village", dataIndex: "village_name", key: "village_name", render: (v) => v || "-" },
    { title: "Division", dataIndex: "division", key: "division", render: (v) => v || "-" },
    { title: "Range", dataIndex: "range", key: "range", render: (v) => v || "-" },
    { title: "Round", dataIndex: "round", key: "round", render: (v) => v || "-" },
    { title: "Beat", dataIndex: "beat", key: "beat", render: (v) => v || "-" },
    { title: "Alert Village", dataIndex: "village", key: "village", render: (v, record) => v || record.village_name || "-" },
    { title: "Month", dataIndex: "month", key: "month", render: (v) => v || "-" },
    { title: "Pixel ID", dataIndex: "pixel_id", key: "pixel_id" },
    { title: "Status", dataIndex: "alert_status", key: "alert_status", render: (v) => <Tag color={v === "Resolved" ? "success" : "warning"}>{v || "Pending"}</Tag> },
    { title: "Action Taken", dataIndex: "action_taken", key: "action_taken", render: (v) => v || "No action taken" },
    {
      title: "Sent At (IST)",
      dataIndex: "sent_at",
      key: "sent_at",
      render: (v) => formatSentAt(v),
    },
    {
      title: "Action",
      key: "action",
      fixed: "right",
      width: 120,
      render: (_, record) => (
        <Button type="link" icon={<EyeOutlined />} onClick={() => showDetails(record)}>
          View Details
        </Button>
      ),
    },
  ];

  const monthlyColumns = [
    { title: "Month", dataIndex: "month", key: "month" },
    { title: "Division", dataIndex: "division", key: "division" },
    { title: "Range", dataIndex: "range", key: "range", render: (v) => v || "-" },
    { title: "Round", dataIndex: "round", key: "round", render: (v) => v || "-" },
    { title: "Beat", dataIndex: "beat", key: "beat", render: (v) => v || "-" },
    { title: "Village", dataIndex: "village", key: "village", render: (v) => v || "-" },
    { title: "Alerts Generated", dataIndex: "alerts_generated", key: "alerts_generated" },
    { title: "Resolved", dataIndex: "resolved", key: "resolved", render: (v) => <Tag color="success">{v}</Tag> },
    { title: "Pending", dataIndex: "pending", key: "pending", render: (v) => <Tag color="warning">{v}</Tag> },
  ];

  return (
    <div className="container ndvi-notifications-page" style={{ padding: 24 }}>
      <h3 className="main-heading">NDVI Notifications</h3>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={12} lg={6}><Card><Statistic title="Users Received" value={summary.users_received || 0} /></Card></Col>
        <Col xs={24} md={12} lg={6}><Card><Statistic title="Total Notifications" value={summary.total_notifications || 0} /></Card></Col>
        <Col xs={24} md={12} lg={6}><Card><Statistic title="Resolved" value={summary.resolved || 0} valueStyle={{ color: "#3f8600" }} /></Card></Col>
        <Col xs={24} md={12} lg={6}><Card><Statistic title="Pending" value={summary.pending || 0} valueStyle={{ color: "#faad14" }} /></Card></Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="middle">
          {renderSelect("user_id", "User ID", options.user_ids)}
          {renderSelect("division", "Division", options.divisions)}
          {renderSelect("month", "Month", options.months)}
          {renderSelect("status", "Status", options.statuses)}
          {renderSelect("table_name", "NDVI Table", options.tables, 6)}
          <Col xs={24} md={8} lg={5}><RangePicker style={{ width: "100%" }} value={filters.dates} onChange={(dates) => setFilters((p) => ({ ...p, dates }))} /></Col>
          <Col xs={24} md={8} lg={4}>
            <Space>
              <Button icon={<SearchOutlined />} type="primary" onClick={() => fetchReport()}>Filter</Button>
              <Button icon={<ReloadOutlined />} onClick={clearFilters}>Clear</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Card title="Monthly Division-wise NDVI Alert Summary" style={{ marginBottom: 16 }}>
        <Table columns={monthlyColumns} dataSource={monthlySummary} loading={loading} pagination={{ pageSize: 5 }} scroll={{ x: "max-content" }} />
      </Card>

      <Card title="Notification Data" extra={<Button icon={<DownloadOutlined />} onClick={exportToExcel}>Export</Button>}>
        <Table columns={columns} dataSource={data} loading={loading} scroll={{ x: "max-content" }} />
      </Card>

      <Modal
        title="Notification Details"
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        footer={null}
        width={700}
      >
        {detailRecord && (
          <div>
            {detailRecord.has_image && (
              <div style={{ marginBottom: 16, textAlign: "center" }}>
                {detailImageLoading ? (
                  <p>Loading image...</p>
                ) : detailImageUrl ? (
                  <Image
                    src={detailImageUrl}
                    alt="NDVI Alert"
                    style={{ maxWidth: "100%", maxHeight: 300, borderRadius: 8 }}
                    fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
                  />
                ) : (
                  <p>Image not available</p>
                )}
              </div>
            )}

            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="User ID">{detailRecord.user_id || "-"}</Descriptions.Item>
              <Descriptions.Item label="Subscribed Village">{detailRecord.village_name || "-"}</Descriptions.Item>
              <Descriptions.Item label="Division">{detailRecord.division || "-"}</Descriptions.Item>
              <Descriptions.Item label="Range">{detailRecord.range || "-"}</Descriptions.Item>
              <Descriptions.Item label="Round">{detailRecord.round || "-"}</Descriptions.Item>
              <Descriptions.Item label="Beat">{detailRecord.beat || "-"}</Descriptions.Item>
              <Descriptions.Item label="Alert Village">{detailRecord.village || detailRecord.village_name || "-"}</Descriptions.Item>
              <Descriptions.Item label="Month">{detailRecord.month || "-"}</Descriptions.Item>
              <Descriptions.Item label="Pixel ID">{detailRecord.pixel_id || "-"}</Descriptions.Item>
              <Descriptions.Item label="NDVI Table">{detailRecord.table_name || "-"}</Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={detailRecord.alert_status === "Resolved" ? "success" : "warning"}>
                  {detailRecord.alert_status || "Pending"}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Has Image">
                <Tag color={detailRecord.has_image ? "blue" : "default"}>
                  {detailRecord.has_image ? "Yes" : "No"}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Action Taken" span={2}>
                {detailRecord.action_taken || "No action taken"}
              </Descriptions.Item>
              <Descriptions.Item label="Note" span={2}>
                {detailRecord.note || "No note available"}
              </Descriptions.Item>
              <Descriptions.Item label="Sent At (IST)" span={2}>
                {formatSentAt(detailRecord.sent_at)}
              </Descriptions.Item>
              <Descriptions.Item label="Latitude">
                {detailRecord.latitude ? (
                  <Button
                    type="link"
                    icon={<EnvironmentOutlined />}
                    onClick={() => openInGoogleMaps(detailRecord.latitude, detailRecord.longitude)}
                    style={{ padding: 0 }}
                  >
                    {Number(detailRecord.latitude).toFixed(6)}
                  </Button>
                ) : "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Longitude">
                {detailRecord.longitude ? (
                  <Button
                    type="link"
                    icon={<EnvironmentOutlined />}
                    onClick={() => openInGoogleMaps(detailRecord.latitude, detailRecord.longitude)}
                    style={{ padding: 0 }}
                  >
                    {Number(detailRecord.longitude).toFixed(6)}
                  </Button>
                ) : "-"}
              </Descriptions.Item>
            </Descriptions>

            {detailRecord.latitude && detailRecord.longitude && (
              <div style={{ marginTop: 16, textAlign: "center" }}>
                <Button
                  type="primary"
                  icon={<EnvironmentOutlined />}
                  onClick={() => openInGoogleMaps(detailRecord.latitude, detailRecord.longitude)}
                >
                  View Location on Google Maps
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default NDVINotifications;
