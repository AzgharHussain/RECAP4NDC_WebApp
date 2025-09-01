// components/DateSelector.js
import React from 'react';

const DateSelector = ({ dates, onDateChange }) => {
  const handleChange = (period, field, value) => {
    onDateChange(period, field, value);
  };

  return (
    <div className="date-selector">
      <h3>Date Range</h3>
      
      <div className="date-group">
        <h4>2018 Data</h4>
        <div className="date-input">
          <label>Start Date:</label>
          <input
            type="date"
            value={dates.startDate2018}
            onChange={(e) => handleChange('2018', 'startDate', e.target.value)}
          />
        </div>
        <div className="date-input">
          <label>End Date:</label>
          <input
            type="date"
            value={dates.endDate2018}
            onChange={(e) => handleChange('2018', 'endDate', e.target.value)}
          />
        </div>
      </div>
      
      <div className="date-group">
        <h4>2024 Data</h4>
        <div className="date-input">
          <label>Start Date:</label>
          <input
            type="date"
            value={dates.startDate2024}
            onChange={(e) => handleChange('2024', 'startDate', e.target.value)}
          />
        </div>
        <div className="date-input">
          <label>End Date:</label>
          <input
            type="date"
            value={dates.endDate2024}
            onChange={(e) => handleChange('2024', 'endDate', e.target.value)}
          />
        </div>
      </div>
    </div>
  );
};

export default DateSelector;