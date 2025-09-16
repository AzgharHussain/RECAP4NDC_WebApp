import React from "react";
import { Table, Button, Input, Select, DatePicker } from "antd";
import { SearchOutlined } from '@ant-design/icons';
import './PatrolIncidentLogs.css';  // Import the CSS for styling
import exportIcon from '../assets/excel.png';

const { Option } = Select;

const PatrolIncidentLogs = () => {

  return (
    <div className="container">
      {/* Patrolling Logs */}
      <div className="section">
        <div className="heading-container">
        <h3 className="main-heading">
        Patrolling Logs</h3>
        <div className="filters">
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
          <DatePicker placeholder="Search by Start Date & Time" style={{
              width: "200px",
              color: '#fff',
              border: '2.21px solid rgba(255, 255, 255, 0.23)',
              background: 'rgba(255, 255, 255, 0.02)',
              boxShadow:
                '-10.261px -10.261px 5.13px -11.971px #B3B3B3 inset, 13.681px 13.681px 7.696px -15.391px #FFF inset',
            }} />
          <DatePicker placeholder="Search by End Date & Time" style={{
              width: "200px",
              color: '#fff',
              border: '2.21px solid rgba(255, 255, 255, 0.23)',
              background: 'rgba(255, 255, 255, 0.02)',
              boxShadow:
                '-10.261px -10.261px 5.13px -11.971px #B3B3B3 inset, 13.681px 13.681px 7.696px -15.391px #FFF inset',
            }} />
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
        <Table className="transparent-table" /* other props */ 

          columns={[
            { title: "Patrol ID", dataIndex: "patrolId", key: "patrolId" },
            { title: "Officer Name", dataIndex: "officerName", key: "officerName" },
            { title: "Patrol Start Date & Time", dataIndex: "startTime", key: "startTime" },
            { title: "Patrol End Date & Time", dataIndex: "endTime", key: "endTime" },
            { title: "Starting Point Location", dataIndex: "startLocation", key: "startLocation" },
            { title: "End Point Location", dataIndex: "endLocation", key: "endLocation" },
            { title: "Distance (in Kms)", dataIndex: "distance", key: "distance" },
            { title: "Route", dataIndex: "route", key: "route", render: (_, record) => <Button>View</Button> },
          ]}
          dataSource={[]}  // Empty array to remove data rows
          pagination={false}
          bordered
        />
      </div>

      {/* Incident Logs */}
      <div className="section">
         <div className="heading-container">
        <h3 className="main-heading">Incident Logs</h3>
        <div className="filters">
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
          <Select defaultValue="All" style={{ width: "200px" }}>
            <Option value="All">All Incident Categories</Option>
            <Option value="Poaching">Poaching</Option>
            <Option value="Illegal Logging">Illegal Logging</Option>
            <Option value="Encroachment">Encroachment</Option>
          </Select>
          <DatePicker placeholder="Search by Incident Date & Time" style={{
              width: "200px",
              color: '#fff',
              border: '2.21px solid rgba(255, 255, 255, 0.23)',
              background: 'rgba(255, 255, 255, 0.02)',
              boxShadow:
                '-10.261px -10.261px 5.13px -11.971px #B3B3B3 inset, 13.681px 13.681px 7.696px -15.391px #FFF inset',
            }} />
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
      <Table className="transparent-table" /* other props */

          columns={[
            { title: "Incident ID", dataIndex: "incidentId", key: "incidentId" },
            { title: "Patrol ID", dataIndex: "patrolId", key: "patrolId" },
            { title: "Officer Name", dataIndex: "officerName", key: "officerName" },
            { title: "Incident Category", dataIndex: "incidentCategory", key: "incidentCategory" },
            { title: "Incident Date & Time", dataIndex: "incidentTime", key: "incidentTime" },
            { title: "Location (GPS)", dataIndex: "location", key: "location" },
            { title: "Incident Description", dataIndex: "description", key: "description" },
            { title: "Images", dataIndex: "images", key: "images", render: (text) => <img src={text} alt="Incident" style={{ width: 50, height: 50 }} /> },
          ]}
          dataSource={[]}  // Empty array to remove data rows
          pagination={false}
          bordered
        />
      </div>
    </div>
  );
};

export default PatrolIncidentLogs;
