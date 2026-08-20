import React, { useEffect, useState } from "react";
import { Button, Card, Col, DatePicker, Row, Select, Space, Statistic, Table, Tag, message } from "antd";
import { DownloadOutlined, ReloadOutlined, SearchOutlined } from "@ant-design/icons";
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
  return result || "N/A";
};

const NDVINotifications = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [monthlySummary, setMonthlySummary] = useState([]);
  const [options, setOptions] = useState(emptyOptions);
  const [summary, setSummary] = useState({ total_notifications: 0, users_received: 0, resolved: 0, pending: 0 });
  const [filters, setFilters] = useState({ user_id: null, table_name: null, division: null, month: null, status: null, dates: null });

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
      console.log("NDVI notification full rows:", json.data || []);
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
      "User ID": item.user_id || "N/A",
      "Subscribed Village": item.village_name || "N/A",
      Division: item.division || "N/A",
      Range: item.range || "N/A",
      Round: item.round || "N/A",
      Beat: item.beat || "N/A",
      "Alert Village": item.village || item.village_name || "N/A",
      Month: item.month || "N/A",
      "Pixel ID": item.pixel_id || "N/A",
      Status: item.alert_status || "Pending",
      "Action Taken": item.action_taken || "No action taken",
      Note: item.note || "N/A",
      "Has Image": item.has_image ? "Yes" : "No",
      "Sent At (IST)": formatSentAt(item.sent_at, item.sent_at_formatted),
      "Report Generated At": item.report_generated_at || "N/A",
    }));
    const summaryRows = monthlySummary.map((item) => ({
      Month: item.month,
      Division: item.division,
      Range: item.range || "N/A",
      Round: item.round || "N/A",
      Beat: item.beat || "N/A",
      Village: item.village || "N/A",
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

  const columns = [
    { title: "User ID", dataIndex: "user_id", key: "user_id" },
    { title: "Subscribed Village", dataIndex: "village_name", key: "village_name", render: (v) => v || "N/A" },
    { title: "Division", dataIndex: "division", key: "division", render: (v) => v || "N/A" },
    { title: "Range", dataIndex: "range", key: "range", render: (v) => v || "N/A" },
    { title: "Round", dataIndex: "round", key: "round", render: (v) => v || "N/A" },
    { title: "Beat", dataIndex: "beat", key: "beat", render: (v) => v || "N/A" },
    { title: "Alert Village", dataIndex: "village", key: "village", render: (v, record) => v || record.village_name || "N/A" },
    { title: "Month", dataIndex: "month", key: "month", render: (v) => v || "N/A" },
    { title: "Pixel ID", dataIndex: "pixel_id", key: "pixel_id" },
    { title: "Status", dataIndex: "alert_status", key: "alert_status", render: (v) => <Tag color={v === "Resolved" ? "success" : "warning"}>{v || "Pending"}</Tag> },
    { title: "Action Taken", dataIndex: "action_taken", key: "action_taken", render: (v) => v || "No action taken" },
    {
      title: "Sent At (IST)",
      dataIndex: "sent_at",
      key: "sent_at",
      render: (v) => formatSentAt(v),
    },
  ];

  const monthlyColumns = [
    { title: "Month", dataIndex: "month", key: "month" },
    { title: "Division", dataIndex: "division", key: "division" },
    { title: "Range", dataIndex: "range", key: "range", render: (v) => v || "N/A" },
    { title: "Round", dataIndex: "round", key: "round", render: (v) => v || "N/A" },
    { title: "Beat", dataIndex: "beat", key: "beat", render: (v) => v || "N/A" },
    { title: "Village", dataIndex: "village", key: "village", render: (v) => v || "N/A" },
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
    </div>
  );
};

export default NDVINotifications;
