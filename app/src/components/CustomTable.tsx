import React, { useState } from 'react';
import styled from 'styled-components';


interface CustomTableProps {
  headers: string[];
  data: any[][];
  onRowClick?: (rowData: any[]) => void;
  selectedRow?: number;
  rowsPerPage?: number;
}

export const CustomTable: React.FC<CustomTableProps> = ({ headers, data, onRowClick, selectedRow, rowsPerPage = 10 }) => {
  const [currentPage, setCurrentPage] = useState(0);

  const totalPages = Math.ceil(data.length / rowsPerPage);

  const handleChangePage = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const paginatedData = data.slice(currentPage * rowsPerPage, (currentPage + 1) * rowsPerPage);

  return (
    <TableContainer>
      <StyledTable>
        <thead>
          <tr>
            {headers.map((header, index) => (
              <TableHeader key={index}>{header}</TableHeader>
            ))}
          </tr>
        </thead>
        <tbody>
          {paginatedData.map((row, rowIndex) => (
            <TableRow key={rowIndex} onClick={() => onRowClick && onRowClick([rowIndex])} selected={rowIndex === selectedRow}>
              {row.map((cell, cellIndex) => (
                <TableCell key={cellIndex}>{cell}</TableCell>
              ))}
            </TableRow>
          ))}
        </tbody>
      </StyledTable>
      <PaginationContainer>
        <PaginationButton disabled={currentPage === 0} onClick={() => handleChangePage(currentPage - 1)}>Previous</PaginationButton>
        <PageInfo>{currentPage + 1} of {totalPages}</PageInfo>
        <PaginationButton disabled={currentPage === totalPages - 1} onClick={() => handleChangePage(currentPage + 1)}>Next</PaginationButton>
      </PaginationContainer>
    </TableContainer>
  );
};

const TableContainer = styled.div`
  width: 100%;
  overflow-x: auto;
`;

const StyledTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 4px;
`;

const TableHeader = styled.th`
  color: rgba(255, 255, 255, 0.8);
  padding: 16px;
  text-align: left;
  border-bottom: 1px solid rgba(255, 255, 255, 0.3);
`;

const TableRow = styled.tr<{ selected: boolean }>`
  &:nth-child(even) {
    background-color: rgba(0, 0, 0, 0.1);
  }
  ${({ selected }) => selected && `
    border: 2px solid rgba(255, 255, 255, 0.8);
    box-shadow: none;
  `}
  ${({ selected }) => !selected && `
    &:hover {
      border: 2px solid rgba(255, 255, 255, 0.8);
      box-shadow: none;
    }
  `}
`;

const TableCell = styled.td`
  padding: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
`;

const PaginationContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
`;

const PaginationButton = styled.button`
  background-color: rgba(0, 0, 0, 0.5);
  color: white;
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s;

  &:hover {
    background-color: rgba(0, 0, 0, 0.8);
  }

  &:disabled {
    background-color: rgba(0, 0, 0, 0.2);
    cursor: not-allowed;
  }
`;

const PageInfo = styled.span`
  color: rgba(255, 255, 255, 0.8);
`;
