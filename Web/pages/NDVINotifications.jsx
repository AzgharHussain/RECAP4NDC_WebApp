import React, { useEffect, useState } from "react";
import { Button, Card, Col, DatePicker, Descriptions, Image, Modal, Row, Select, Space, Statistic, Table, Tag, Tooltip, message } from "antd";
import { DownloadOutlined, EyeOutlined, EnvironmentOutlined, ReloadOutlined, SearchOutlined, InfoCircleOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { API_BASE_URL } from "../config";
import { getAuthHeaders, getUserDivision, matchesDivision } from "../utils/authUtils";
import { capitalizeFirst } from "../utils/textFormat";
import { useLanguage } from "../context/LanguageContext";
import gujaratlogo from "../assets/FOREST DEPT.jpg";
import gisfylogo from "../assets/Gisfylogo.png";

const { RangePicker } = DatePicker;
const { Option } = Select;

const emptyOptions = { usernames: [], villages: [], coupes: [], tables: [], divisions: [], months: [], statuses: ["Pending", "Resolved"] };

// Convert any timestamp to IST (UTC+5:30) and display as DD-MM-YYYY HH:mm:ss
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

const toIST = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (!isNaN(d.getTime())) {
    const istDate = new Date(d.getTime() + IST_OFFSET_MS);
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(istDate.getUTCDate())}-${pad(istDate.getUTCMonth() + 1)}-${istDate.getUTCFullYear()} ${pad(istDate.getUTCHours())}:${pad(istDate.getUTCMinutes())}:${pad(istDate.getUTCSeconds())}`;
  }
  return String(value);
};

const formatSentAt = (value) => {
  const result = toIST(value);
  return result || "-";
};

// ── Language strings ──────────────────────────────────────────────────────────
const TEXTS = {
  en: {
    pageTitle: "NDVI Notifications",
    usersReceived: "Users Received",
    totalNotifications: "Total Notifications",
    resolved: "Resolved",
    pending: "Pending",
    // Filter placeholders
    userId: "User ID",
    userName: "User Name",
    division: "Division",
    month: "Month",
    status: "Status",
    filter: "Filter",
    clear: "Clear",
    // Table columns
    subscribedVillage: "Subscribed Village",
    subscribedVillageHint: "The village the user subscribed to receive NDVI alerts for",
    range: "Range",
    round: "Round",
    beat: "Beat",
    alertVillage: "Alert Village",
    alertVillageHint: "The village where the NDVI vegetation change was detected",
    pixelId: "Pixel ID",
    actionTaken: "Action Taken",
    noActionTaken: "No action taken",
    sentAt: "Sent At (IST)",
    action: "Action",
    viewDetails: "View Details",
    // Section titles
    monthlySummary: "Monthly Division-wise NDVI Alert Summary",
    notificationData: "Notification Data",
    export: "Export",
    alertsGenerated: "Alerts Generated",
    village: "Village",
    // Modal
    notificationDetails: "Notification Details",
    loadingImage: "Loading image...",
    imageNotAvailable: "Image not available",
    hasImage: "Has Image",
    yes: "Yes",
    no: "No",
    note: "Note",
    noNote: "No note available",
    latitude: "Latitude",
    longitude: "Longitude",
    viewOnMaps: "View Location on Google Maps",
    locationUnavailable: "Location coordinates not available",
    noData: "No notification data available to export",
    ndviTable: "NDVI Table",
    startDate: "Start Date",
    endDate: "End Date",
  },
  gu: {
    pageTitle: "NDVI સૂચનાઓ",
    usersReceived: "વપરાશકર્તાઓ પ્રાપ્ત",
    totalNotifications: "કુલ સૂચનાઓ",
    resolved: "નિવારિત",
    pending: "બાકી",
    // Filter placeholders
    userId: "વપરાશકર્તા ID",
    userName: "વપરાશકર્તા નામ",
    division: "વિભાગ",
    month: "મહિનો",
    status: "સ્થિતિ",
    filter: "ફિલ્ટર",
    clear: "સાફ કરો",
    // Table columns
    subscribedVillage: "સભ્ય ગ્રામ",
    subscribedVillageHint: "વપરાશકર્તાએ NDVI ચેતવણી માટે સભ્યતા લીધેલું ગામ",
    range: "રેન્જ",
    round: "રાઉન્ડ",
    beat: "બીટ",
    alertVillage: "ચેતવણી ગ્રામ",
    alertVillageHint: "NDVI વનસ્પતિ પરિવર્તન જોવામાં આવેલું ગામ",
    pixelId: "પિક્સેલ ID",
    actionTaken: "લેવાયેલ પગલું",
    noActionTaken: "કોઈ પગલું નહીં",
    sentAt: "મોકલ્યો (IST)",
    action: "ક્રિયા",
    viewDetails: "વિગતો જુઓ",
    // Section titles
    monthlySummary: "માસિક વિભાગ-વાર NDVI ચેતવણી સારાંશ",
    notificationData: "સૂચના ડેટા",
    export: "નિકાસ",
    alertsGenerated: "ઉત્પન્ન ચેતવણીઓ",
    village: "ગ્રામ",
    // Modal
    notificationDetails: "સૂચના વિગતો",
    loadingImage: "છબી લોડ થઈ રહી છે...",
    imageNotAvailable: "છબી ઉપલબ્ધ નથી",
    hasImage: "છબી છે",
    yes: "હા",
    no: "ના",
    note: "નોંધ",
    noNote: "કોઈ નોંધ નથી",
    latitude: "અક્ષાંશ",
    longitude: "રેખાંશ",
    viewOnMaps: "Google Maps પર સ્થાન જુઓ",
    locationUnavailable: "સ્થાન કોઓર્ડિનેટ્સ ઉપલબ્ધ નથી",
    noData: "નિકાસ માટે કોઈ સૂચના ડેટા ઉપલબ્ધ નથી",
    ndviTable: "NDVI કોષ્ટક",
    startDate: "શરૂઆત તારીખ",
    endDate: "સમાપ્તિ તારીખ",
  },
};

const NDVINotifications = () => {
  const { language } = useLanguage();
  const t = TEXTS[language] || TEXTS.en;

  // Check if the logged-in user has a division to lock
  const lockedDivision = getUserDivision();

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [monthlySummary, setMonthlySummary] = useState([]);
  const [options, setOptions] = useState(emptyOptions);
  const [summary, setSummary] = useState({ total_notifications: 0, users_received: 0, resolved: 0, pending: 0 });
  // table_name kept in state for API calls but no longer shown as a UI filter
  // If user has a locked division, initialize the filter with it
  const [filters, setFilters] = useState({
    username: null, table_name: null,
    division: lockedDivision || null,
    month: null, status: null, dates: null
  });
  const [detailRecord, setDetailRecord] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailImageUrl, setDetailImageUrl] = useState(null);
  const [detailImageLoading, setDetailImageLoading] = useState(false);
  // Pagination state — server-driven
  const [pagination, setPagination] = useState({ current: 1, pageSize: 500, total: 0 });

  const fetchReport = async (overrideFilters = filters, page = pagination.current, pageSize = pagination.pageSize) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      ["username", "table_name", "division", "month", "status"].forEach((key) => {
        if (overrideFilters[key]) params.append(key, overrideFilters[key]);
      });
      if (overrideFilters.dates?.[0]) params.append("start_date", overrideFilters.dates[0].format("YYYY-MM-DD"));
      if (overrideFilters.dates?.[1]) params.append("end_date", overrideFilters.dates[1].format("YYYY-MM-DD"));
      params.append("page", String(page));
      params.append("pageSize", String(pageSize));

      const res = await fetch(`${API_BASE_URL}/api/ndvi-notification-report?${params.toString()}`, { headers: getAuthHeaders() });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to fetch notification report");
      // Apply client-side fuzzy division filter as a backup to the backend ILIKE filter
      let rows = (json.data || []).map((item) => ({ ...item, key: item.id }));
      if (lockedDivision) {
        rows = rows.filter(item =>
          matchesDivision(item.division || '', lockedDivision) ||
          matchesDivision(item.table_name || '', lockedDivision)
        );
      }
      setData(rows);
      let monthlyRows = (json.monthlyDivisionSummary || []).map((item, index) => ({ ...item, key: `${item.month}-${item.division}-${index}` }));
      if (lockedDivision) {
        monthlyRows = monthlyRows.filter(item =>
          matchesDivision(item.division || '', lockedDivision)
        );
      }
      setMonthlySummary(monthlyRows);
      setSummary(json.summary || { total_notifications: 0, users_received: 0, resolved: 0, pending: 0 });
      setOptions({ ...emptyOptions, ...(json.options || {}) });
      if (json.pagination) {
        setPagination(prev => ({
          ...prev,
          current: json.pagination.page,
          pageSize: json.pagination.pageSize,
          total: json.pagination.total,
        }));
      }
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

  // Handle Ant Design Table page change
  const handleTableChange = (pag) => {
    const newPage = pag.current;
    const newPageSize = pag.pageSize;
    setPagination(prev => ({ ...prev, current: newPage, pageSize: newPageSize }));
    fetchReport(filters, newPage, newPageSize);
  };

  const clearFilters = () => {
    // Keep the locked division when clearing filters
    const cleared = { username: null, table_name: null, division: lockedDivision || null, month: null, status: null, dates: null };
    setFilters(cleared);
    setPagination(prev => ({ ...prev, current: 1 }));
    fetchReport(cleared, 1, pagination.pageSize);
  };

  const renderSelect = (key, placeholder, values, span = 4, disabled = false) => (
    <Col xs={24} md={8} lg={span}>
      <Select
        allowClear
        showSearch
        placeholder={placeholder}
        value={filters[key]}
        onChange={(value) => setFilters((prev) => ({ ...prev, [key]: value }))}
        style={{ width: "100%" }}
        optionFilterProp="children"
        disabled={disabled}
      >
        {(values || []).map((value) => <Option key={value} value={value}>{capitalizeFirst(value)}</Option>)}
      </Select>
    </Col>
  );

  const exportToExcel = async () => {
    if (!data.length) {
      message.warning(t.noData);
      return;
    }

    const [XLSX, { saveAs }] = await Promise.all([import("xlsx"), import("file-saver")]);
    const rows = data.map((item, index) => ({
      "Sr. No.": index + 1,
      [t.userId]: item.user_id || "-",
      [t.userName]: item.username || "-",
      [t.division]: item.division || "-",
      [t.range]: item.range || "-",
      [t.round]: item.round || "-",
      [t.beat]: item.beat || "-",
      [t.alertVillage]: item.village || item.village_name || "-",
      [t.month]: item.month || "-",
      [t.pixelId]: item.pixel_id || "-",
      [t.status]: item.alert_status || t.pending,
      [t.actionTaken]: item.action_taken || t.noActionTaken,
      [t.note]: item.note || "-",
      [t.hasImage]: item.has_image ? t.yes : t.no,
      [t.sentAt]: formatSentAt(item.sent_at),
    }));
    const summaryRows = monthlySummary.map((item) => ({
      [t.month]: item.month,
      [t.division]: item.division,
      [t.range]: item.range || "-",
      [t.round]: item.round || "-",
      [t.beat]: item.beat || "-",
      [t.village]: item.village || "-",
      [t.alertsGenerated]: item.alerts_generated,
      [t.resolved]: item.resolved,
      [t.pending]: item.pending,
    }));
    const filterRows = [
      { Filter: t.userName, Value: filters.username || "All" },
      { Filter: t.division,  Value: filters.division  || "All" },
      { Filter: t.month,     Value: filters.month     || "All" },
      { Filter: t.status,    Value: filters.status    || "All" },
      { Filter: t.startDate, Value: filters.dates?.[0]?.format("YYYY-MM-DD") || "All" },
      { Filter: t.endDate,   Value: filters.dates?.[1]?.format("YYYY-MM-DD") || "All" },
      { Filter: t.usersReceived,      Value: summary.users_received     || 0 },
      { Filter: t.totalNotifications, Value: summary.total_notifications || 0 },
      { Filter: t.resolved,           Value: summary.resolved           || 0 },
      { Filter: t.pending,            Value: summary.pending            || 0 },
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
    setDetailImageLoading(false);
    // Always attempt to fetch the image and note if we have table_name and pixel_id,
    // even if has_image is false (the flag may be stale).
    if (record.table_name && record.pixel_id) {
      setDetailImageLoading(true);
      try {
        const params = new URLSearchParams({
          NdvicoupeName: record.table_name,
          id: String(record.pixel_id),
        });
        const url = `${API_BASE_URL}/api/ndvi-change?${params}`;
        const res = await fetch(url, {
          method: "GET",
          headers: { ...getAuthHeaders() },
        });
        if (!res.ok) {
          console.error("NDVI image fetch failed:", res.status, res.statusText, "URL:", url);
          const errText = await res.text().catch(() => "");
          console.error("NDVI image fetch error body:", errText);
        } else {
          const json = await res.json();
          if (json.success && json.data && json.data[0]) {
            const data = json.data[0];
            // Update image
            if (data.image_data) {
              setDetailImageUrl(`data:${data.image_type || "image/jpeg"};base64,${data.image_data}`);
            } else {
              console.warn("NDVI record found but image_data is null. Table:", record.table_name, "Pixel ID:", record.pixel_id);
            }
            // Update note and other fields from the source table
            setDetailRecord((prev) => ({
              ...prev,
              note: data.note || prev.note,
              latitude: data.latitude || prev.latitude,
              longitude: data.longitude || prev.longitude,
              status: data.status !== undefined ? data.status : prev.status,
            }));
          } else {
            console.warn("NDVI image fetch returned no data. Response:", JSON.stringify(json).substring(0, 200));
          }
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
      message.warning(t.locationUnavailable);
    }
  };

  // Generic sorter for string/number values
  const genericSorter = (dataIndex) => (a, b) => {
    const av = a[dataIndex];
    const bv = b[dataIndex];
    if (av == null && bv == null) return 0;
    if (av == null) return -1;
    if (bv == null) return 1;
    if (typeof av === "number" && typeof bv === "number") return av - bv;
    return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: "base" });
  };

  const columns = [
    { title: t.userId,            dataIndex: "user_id",      key: "user_id",      sorter: genericSorter("user_id") },
    { title: t.userName,          dataIndex: "username",     key: "username",     sorter: genericSorter("username"),     render: (v) => v || "-" },
    { title: t.division,          dataIndex: "division",     key: "division",     sorter: genericSorter("division"),     render: (v) => v || "-" },
    { title: t.range,             dataIndex: "range",        key: "range",        sorter: genericSorter("range"),        render: (v) => v || "-" },
    { title: t.round,             dataIndex: "round",        key: "round",        sorter: genericSorter("round"),        render: (v) => v || "-" },
    { title: t.beat,              dataIndex: "beat",         key: "beat",         sorter: genericSorter("beat"),         render: (v) => v || "-" },
    { title: t.alertVillage,      dataIndex: "village",      key: "village",      sorter: genericSorter("village"),      render: (v, record) => v || record.village_name || "-",
      titleRender: () => (
        <span>{t.alertVillage} <Tooltip title={t.alertVillageHint}><InfoCircleOutlined style={{ color: '#999', fontSize: 12 }} /></Tooltip></span>
      ) },
    { title: t.month,             dataIndex: "month",        key: "month",        sorter: genericSorter("month"),        render: (v) => v || "-" },
    { title: t.pixelId,           dataIndex: "pixel_id",     key: "pixel_id",     sorter: genericSorter("pixel_id") },
    {
      title: t.status,
      dataIndex: "alert_status",
      key: "alert_status",
      sorter: genericSorter("alert_status"),
      render: (v) => <Tag color={v === "Resolved" ? "success" : "warning"}>{v || t.pending}</Tag>,
    },
    { title: t.actionTaken, dataIndex: "action_taken", key: "action_taken", sorter: genericSorter("action_taken"), render: (v) => v || t.noActionTaken },
    {
      title: t.hasImage,
      dataIndex: "has_image",
      key: "has_image",
      sorter: genericSorter("has_image"),
      render: (hasImage, record) =>
        hasImage ? (
          <Button type="link" style={{ padding: 0 }} onClick={() => showDetails(record)}>
            {t.yes}
          </Button>
        ) : (
          <Tag>{t.no}</Tag>
        ),
    },
    {
      title: t.sentAt,
      dataIndex: "sent_at",
      key: "sent_at",
      sorter: genericSorter("sent_at"),
      render: (v) => formatSentAt(v),
    },
    {
      title: t.action,
      key: "action",
      fixed: "right",
      width: 130,
      render: (_, record) => (
        <Button type="link" icon={<EyeOutlined />} onClick={() => showDetails(record)}>
          {t.viewDetails}
        </Button>
      ),
    },
  ];

  const monthlyColumns = [
    { title: t.month,          dataIndex: "month",            key: "month",            sorter: genericSorter("month") },
    { title: t.division,       dataIndex: "division",         key: "division",         sorter: genericSorter("division") },
    { title: t.range,          dataIndex: "range",            key: "range",            sorter: genericSorter("range"),            render: (v) => v || "-" },
    { title: t.round,          dataIndex: "round",            key: "round",            sorter: genericSorter("round"),            render: (v) => v || "-" },
    { title: t.beat,           dataIndex: "beat",             key: "beat",             sorter: genericSorter("beat"),             render: (v) => v || "-" },
    { title: t.village,        dataIndex: "village",          key: "village",          sorter: genericSorter("village"),          render: (v) => v || "-" },
    { title: t.alertsGenerated, dataIndex: "alerts_generated", key: "alerts_generated", sorter: genericSorter("alerts_generated") },
    { title: t.resolved,       dataIndex: "resolved",         key: "resolved",         sorter: genericSorter("resolved"),         render: (v) => <Tag color="success">{v}</Tag> },
    { title: t.pending,        dataIndex: "pending",          key: "pending",          sorter: genericSorter("pending"),          render: (v) => <Tag color="warning">{v}</Tag> },
  ];

  return (
    <div className="container ndvi-notifications-page" style={{ padding: 24 }}>
      <h3 className="main-heading">{t.pageTitle}</h3>

      {/* ── Stat cards ── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={12} lg={6}><Card><Statistic title={t.usersReceived}      value={summary.users_received     || 0} /></Card></Col>
        <Col xs={24} md={12} lg={6}><Card><Statistic title={t.totalNotifications} value={summary.total_notifications || 0} /></Card></Col>
        <Col xs={24} md={12} lg={6}><Card><Statistic title={t.resolved}           value={summary.resolved           || 0} valueStyle={{ color: "#3f8600" }} /></Card></Col>
        <Col xs={24} md={12} lg={6}><Card><Statistic title={t.pending}            value={summary.pending            || 0} valueStyle={{ color: "#faad14" }} /></Card></Col>
      </Row>

      {/* ── Filters (NDVI Table filter removed) ── */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="middle">
          {renderSelect("username", t.userName, options.usernames, 5)}
          {renderSelect("division", t.division, options.divisions, 5, !!lockedDivision)}
          {renderSelect("month",    t.month,    options.months,    4)}
          {renderSelect("status",   t.status,   options.statuses,  4)}
          <Col xs={24} md={8} lg={4}>
            <RangePicker
              style={{ width: "100%" }}
              value={filters.dates}
              onChange={(dates) => setFilters((p) => ({ ...p, dates }))}
            />
          </Col>
        </Row>
        <Row gutter={[12, 12]} style={{ marginTop: 12 }} justify="end">
          <Col xs={24} md={8} lg={4} style={{ textAlign: "right" }}>
            <Space>
              <Button icon={<SearchOutlined />} type="primary" onClick={() => fetchReport()}>{t.filter}</Button>
              <Button icon={<ReloadOutlined />} onClick={clearFilters}>{t.clear}</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* ── Monthly summary table ── */}
      <Card title={t.monthlySummary} style={{ marginBottom: 16 }}>
        <Table
          columns={monthlyColumns}
          dataSource={monthlySummary}
          loading={loading}
          pagination={{ pageSize: 5 }}
          scroll={{ x: "max-content" }}
        />
      </Card>

      {/* ── Notification data table (server-side pagination) ── */}
      <Card
        title={t.notificationData}
        extra={<Button icon={<DownloadOutlined />} onClick={exportToExcel}>{t.export}</Button>}
      >
        <Table
          columns={columns}
          dataSource={data}
          loading={loading}
          scroll={{ x: "max-content" }}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total || summary.total_notifications,
            showSizeChanger: true,
            pageSizeOptions: [100, 250, 500, 1000],
            showTotal: (total, range) => `${range[0]}–${range[1]} of ${total} items`,
          }}
          onChange={handleTableChange}
        />
      </Card>

      {/* ── Detail modal ── */}
      <Modal
        title={t.notificationDetails}
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        footer={null}
        width={700}
      >
        {detailRecord && (
          <div>
            {/* Image section — always attempt to show if we have a URL */}
            <div style={{ marginBottom: 16, textAlign: "center" }}>
              {detailImageLoading ? (
                <p>{t.loadingImage}</p>
              ) : detailImageUrl ? (
                <div>
                  <Image
                    src={detailImageUrl}
                    alt="NDVI Alert"
                    style={{ maxWidth: "100%", maxHeight: 300, borderRadius: 8 }}
                    fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
                  />
                  <div style={{ marginTop: 8 }}>
                    <Button
                      type="link"
                      icon={<EyeOutlined />}
                      onClick={() => window.open(detailImageUrl, "_blank")}
                    >
                      View Full Image
                    </Button>
                  </div>
                </div>
              ) : (
                <p>{t.imageNotAvailable}</p>
              )}
            </div>

            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label={t.userId}>{detailRecord.user_id || "-"}</Descriptions.Item>
              <Descriptions.Item label={t.userName}>{detailRecord.username || "-"}</Descriptions.Item>
              <Descriptions.Item label={t.division}>{detailRecord.division || "-"}</Descriptions.Item>
              <Descriptions.Item label={t.range}>{detailRecord.range || "-"}</Descriptions.Item>
              <Descriptions.Item label={t.round}>{detailRecord.round || "-"}</Descriptions.Item>
              <Descriptions.Item label={t.beat}>{detailRecord.beat || "-"}</Descriptions.Item>
              <Descriptions.Item label={<span>{t.alertVillage} <Tooltip title={t.alertVillageHint}><InfoCircleOutlined style={{ color: '#999', fontSize: 12 }} /></Tooltip></span>}>{detailRecord.village || detailRecord.village_name || "-"}</Descriptions.Item>
              <Descriptions.Item label={t.month}>{detailRecord.month || "-"}</Descriptions.Item>
              <Descriptions.Item label={t.pixelId}>{detailRecord.pixel_id || "-"}</Descriptions.Item>
              <Descriptions.Item label={t.ndviTable}>{detailRecord.table_name || "-"}</Descriptions.Item>
              <Descriptions.Item label={t.status}>
                <Tag color={detailRecord.alert_status === "Resolved" ? "success" : "warning"}>
                  {detailRecord.alert_status || t.pending}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t.hasImage}>
                <Tag color={detailRecord.has_image ? "blue" : "default"}>
                  {detailRecord.has_image ? t.yes : t.no}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t.actionTaken} span={2}>
                {detailRecord.action_taken || t.noActionTaken}
              </Descriptions.Item>
              <Descriptions.Item label={t.note} span={2}>
                {detailRecord.note || t.noNote}
              </Descriptions.Item>
              <Descriptions.Item label={t.sentAt} span={2}>
                {formatSentAt(detailRecord.sent_at)}
              </Descriptions.Item>
              <Descriptions.Item label={t.latitude}>
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
              <Descriptions.Item label={t.longitude}>
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
                  {t.viewOnMaps}
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* FOOTER */}
      <footer className="footer" style={{
        color: 'black',
        textAlign: 'center',
        padding: '15px',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center'
      }}>
        <div>
          <p style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            © 2026 Gujarat Forest Department
            <img src={gujaratlogo} alt="logo picture" style={{ width: '40px' }} />
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <p>Powered by</p>
          <a href="https://www.gisfy.co.in/" target="_blank" rel="noopener noreferrer">
            <img
              src={gisfylogo}
              alt="logo picture"
              style={{ width: '100px', height: '40px' }}
            />
          </a>
        </div>
      </footer>
    </div>
  );
};

export default NDVINotifications;
