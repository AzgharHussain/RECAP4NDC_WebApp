import React,{useState} from "react";
import { Table, Button, Input, Select, DatePicker } from "antd";
import { SearchOutlined } from '@ant-design/icons'; // Import the Search icon
import "./PatrolIncidentLogs.css";
import exportIcon from '../assets/excel.png';
import noDataImage from '../assets/no-data.png';

const { Option } = Select;

const CoupeObservation = () => {
  const [filteredData, setFilteredData] = useState([]);
  // Only columns (no data)
  const columns = [
    { title: 'Coupe ID', dataIndex: 'coupeId', key: 'coupeId' },
    { title: 'Issue ID', dataIndex: 'issueId', key: 'issueId' },
    { title: 'Officer Name', dataIndex: 'officerName', key: 'officerName' },
    { title: 'Submitted Date & Time', dataIndex: 'submittedDateTime', key: 'submittedDateTime' },
    { title: 'Size', dataIndex: 'size', key: 'size' },
    { title: 'Forest Type', dataIndex: 'forestType', key: 'forestType' },
    { title: 'Slope', dataIndex: 'slope', key: 'slope' },
    { title: 'Soil Type', dataIndex: 'soilType', key: 'soilType' },
    { title: 'Issue Type', dataIndex: 'issueType', key: 'issueType' },
    { title: 'Incident Description', dataIndex: 'incidentDescription', key: 'incidentDescription' },
    {
      title: 'Images',
      dataIndex: 'image',
      key: 'image',
      render: (text) => (
        <img src={text} alt="Incident" style={{ width: 50, height: 50, borderRadius: 4 }} />
      ),
    },
  ];

  return (
    <div style={{ borderRadius: '10px', padding: '-8px' }}>
      <div className="heading-container">
        <h3 className="main-heading">Working Plan Areas (Coupe Observation Log)</h3>

        {/* Filters Section */}
        <div className="filters-section">
          <Input
            placeholder="Search by Officer Name"
            style={{
              width: "200px",
              background: 'rgba(255, 255, 255, 0.2)',
              color: '#fff',
              border: 'none',
            }}
            suffix={<SearchOutlined style={{ color: 'rgba(0, 0, 0, 0.25)', fontSize: '16px' }} />} // Light black (dark grey)
          />

          <Select
            defaultValue="All"
            style={{
              width: "200px",
              background: 'rgba(255, 255, 255, 0.2)',
              color: '#fff',
              border: 'none',
            }}
          >
            <Option value="All">All Issue Types</Option>
            <Option value="Invasive Species">Invasive Species</Option>
            <Option value="Illegal Logging">Illegal Logging</Option>
            <Option value="Tree Disease">Tree Disease</Option>
          </Select>

          <DatePicker
            placeholder="Select To Date"
            style={{
              width: "200px",
              color: '#fff',
              border: '2.21px solid rgba(255, 255, 255, 0.23)',
              background: 'rgba(255, 255, 255, 0.02)',
              boxShadow:
                '-10.261px -10.261px 5.13px -11.971px #B3B3B3 inset, 13.681px 13.681px 7.696px -15.391px #FFF inset',
            }}
          />

          <Button className="btn-Export">
            Export
            <img
              src={exportIcon}
              alt="Export Icon"
              className="btn-icon"
            />
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
                locale={{
                    emptyText: (
                      <div style={{ textAlign: 'center', padding: '50px 0' }}>
                        <img
                          src={noDataImage}
                          alt="No Data"
                          style={{ width: 60, marginBottom: 16 }}
                        />
                        <div style={{ fontSize: 16, color: '#00442c', fontWeight: 500 }}>
                          No data available
                        </div>
                      </div>
                    ),
                  }}
              />
    </div>
  );
};

export default CoupeObservation;
