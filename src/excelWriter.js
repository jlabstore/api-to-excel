
const ExcelJS = require("exceljs");
const fs = require("fs-extra");
const path = require("path");
const moment = require("moment");
const config = require("../config.json");

// 실행
const templatePath = config.excelTemplate; // 템플릿 파일 경로
const outputPath = config.excelOutput; // 출력 파일
const writer = config.writer;           // 작성자 
const responseCdType = config.responseCdType;
const DATA_DEFAULT_END_ROW = 35;
const DATA_DEFAULT_ROW = 15;
const TEMPLATE_SEET_NO = 'Sample';

function reduceJson(data){
    const jsonData = data.reduce((acc, item) => {
        acc[item.field] = item.listData ? [reduceJson(item.listData)] : item.data ? reduceJson(item.data) :   item.example;;
        return acc;
    }, {}); 
    return jsonData;
}

function toQueryParams(dataArray) {
    if(dataArray){
        return dataArray
            .map(item => `${item.field}=${item.example}`)
            .join('&');
    }else{
        return '';
    }
}


function addSheetRow(sheet, rownum){
    const rowToCopy = 21; // 복사할 행 번호

    // 🔹 새로운 행 삽입 후, 기존 행을 복사
    const newRow = sheet.insertRow(rownum, []);

    // 🔹 스타일도 복사
    sheet.getRow(rowToCopy).eachCell((cell, colNumber) => {
        newRow.getCell(colNumber).style = cell.style;
    });
}

function drawCellData(sheet, data){
    // 🔹 특정 좌표(Cell)에 데이터 입력
    sheet.getCell("D3").value = data.summary;       //인터페이스 명
    sheet.getCell("D4").value = data.description;   //인터페이스 개요
    sheet.getCell("D6").value = data.url;           //호출 URL
    sheet.getCell("D9").value = data.method;        //호출 Method
    sheet.getCell("D7").value = writer;             //매핑스펙 작성자
    sheet.getCell("M7").value = moment().format('YYYY.MM.DD');      //매핑스펙 작성일 
    sheet.getCell("D8").value = data.interfaceId;  //인터페이스 ID 
    sheet.getCell("D16").value = data.method && data.method == 'GET' ? 'QueryParam':'RequestBody';  //송신데이터 처리유형
    sheet.getCell("D14").value = data.sourceSystemName;     //시스템명 
    sheet.getCell("M14").value = data.targetSystemName;     //시스템명 
    sheet.getCell("D5").value = data.menuData;

    // data row 행추가 
    let requestRow = 0;
    let responseRow = 3;

    requestRow += data.requestData ? data.requestData.length : 0;
    data.requestData &&  data.requestData.forEach(field => {
        if(field.listData) requestRow+=field.listData.length;
        if(field.data) requestRow+=field.data.length;
    });
    if(data.requestPathData && data.requestPathData.length > 0){
        requestRow += data.requestPathData.length;
    }
    if(data.requestParamData && data.requestParamData.length > 0){
        requestRow += data.requestParamData.length;
    }

    responseRow += data.responseData ? data.responseData.length : 0;
    data.responseData &&  data.responseData.forEach(field => {
        if(field.listData) responseRow+=field.listData.length;
        if(field.data) responseRow+=field.data.length;
    });

    const totalDataRow = responseRow > requestRow ? responseRow : requestRow;
    const addRow = totalDataRow - DATA_DEFAULT_ROW < 0 ? 0 : totalDataRow - DATA_DEFAULT_ROW ;
    const dataEndRow = DATA_DEFAULT_END_ROW + addRow;
    if(totalDataRow > DATA_DEFAULT_ROW){
        for(let i = DATA_DEFAULT_END_ROW; i < dataEndRow; i++) {
            addSheetRow(sheet, i-1);
        }
        try {
            sheet.unMergeCells(`J24:J${dataEndRow}`);
            sheet.mergeCells(`J24:J${dataEndRow}`);
        } catch (error) {}
    }
    // if(requestRow > 1){
    //     try {
    //         sheet.mergeCells(`B21:B${20+requestRow}`);
    //     } catch (error) {}
    // }

    // 데이터 입력 시작 행 (엑셀 좌표 기준)
    let startRow = 21; 

    // 🔹 요청 path 파람 리스트를 테이블 형식으로 채우기
    if(data.requestPathData){
        data.requestPathData && data.requestPathData.forEach((field, index) => {
            let rownum = startRow + index;
            sheet.getCell(`B${rownum}`).value = 'PathParam';
            sheet.getCell(`C${rownum}`).value = field.description;
            sheet.getCell(`D${rownum}`).value = field.field;
            sheet.getCell(`F${rownum}`).value = field.type;
            sheet.getCell(`I${rownum}`).value = field.example && field.example.trim() !='' ? `ex) ${field.example}` :'';
            sheet.getCell(`H${rownum}`).value = 'Y'; 
        });
        startRow+= data.requestPathData.length;
    }


    if(data.requestParamData){
        data.requestParamData && data.requestParamData.forEach((field, index) => {
            let rownum = startRow + index;
            sheet.getCell(`B${rownum}`).value = 'RequestParam';
            sheet.getCell(`C${rownum}`).value = field.description;
            sheet.getCell(`D${rownum}`).value = field.field;
            sheet.getCell(`F${rownum}`).value = field.type;
            sheet.getCell(`I${rownum}`).value = field.example && field.example.trim() !='' ? `ex) ${field.example}` :'';
        });
        startRow+= data.requestParamData.length;
    }



    // 🔹 요청 필드 리스트를 테이블 형식으로 채우기
    if(data.requestData){
        const requestDv = data.method == 'GET' ? 'RequestParam' : 'RequestBody';

        data.requestData.forEach((field, index) => {
            let rownum = startRow + index;
            sheet.getCell(`B${rownum}`).value = requestDv;
            sheet.getCell(`C${rownum}`).value = field.description;
            sheet.getCell(`D${rownum}`).value = field.field;
            sheet.getCell(`F${rownum}`).value = field.type;
            sheet.getCell(`I${rownum}`).value = field.example && field.example.trim() !='' ? `ex) ${field.example}` :'';

            if(field.listData){
                field.listData.forEach((field2, index2) => {
                    startRow++;
                    let rownum2 = rownum + index2 + 1;
                    sheet.getCell(`B${rownum2}`).value = requestDv;
                    sheet.getCell(`C${rownum2}`).value = field2.description;
                    sheet.getCell(`E${rownum2}`).value = field2.field;
                    sheet.getCell(`F${rownum2}`).value = field2.type;
                    sheet.getCell(`I${rownum2}`).value = field2.example && field2.example.trim() !='' ? `ex) ${field2.example}` :'';
                });
            }else if(field.data){
                field.data.forEach((field2, index2) => {
                    startRow++;
                    let rownum2 = rownum + index2 + 1;
                    sheet.getCell(`B${rownum2}`).value = requestDv;
                    sheet.getCell(`C${rownum2}`).value = field2.description;
                    sheet.getCell(`E${rownum2}`).value = field2.field;
                    sheet.getCell(`F${rownum2}`).value = field2.type;
                    sheet.getCell(`I${rownum2}`).value = field2.example && field2.example.trim() !='' ? `ex) ${field2.example}` :'';
                });
            }
        });
    }

    // Request String
    let requstDataString = '';
    if(data.method == 'GET'){
        requstDataString = data.url;

        data.requestPathData && data.requestPathData.forEach((field, index) => {
            if(field.example && field.example != ''){
                requstDataString = requstDataString.replace(`\{${field.field}\}`, field.example)
            }
        });

        if((data.requestData && data.requestData.length>0) || (data.requestParamData && data.requestParamData.length>0)){
            const query = toQueryParams(data.requestData) + toQueryParams(data.requestParamData) ;
            if(query){
                requstDataString += '?' + query;
            }
        }
    }else{
        if(data.requestData){
            const jsonData = reduceJson(data.requestData)
            requstDataString = JSON.stringify(jsonData &&  data.requestType.startsWith('List') ? [jsonData]:jsonData, null, 4);
        }
    }
    sheet.getCell(`B${dataEndRow + 3}`).value = requstDataString;
    

    // 🔹 응답 필드 리스트 입력
    if(data.responseData){
        let responseStartRow = 24; // 요청 필드 아래에 응답 필드 삽입
        data.responseData.forEach((field, index) => {
            let rownum = responseStartRow + index;
            sheet.getCell(`K${rownum}`).value = field.description;
            sheet.getCell(`L${rownum}`).value = field.field;
            sheet.getCell(`N${rownum}`).value = field.type;
            sheet.getCell(`Q${rownum}`).value = field.example && field.example.trim() !='' ? `ex) ${field.example}` :'';

            if(field.listData){
                field.listData.forEach((field2, index2) => {
                    responseStartRow++;
                    let rownum2 = rownum + index2 + 1;
                    sheet.getCell(`K${rownum2}`).value = field2.description;
                    sheet.getCell(`M${rownum2}`).value = field2.field;
                    sheet.getCell(`N${rownum2}`).value = field2.type;
                    sheet.getCell(`Q${rownum2}`).value = field2.example && field2.example.trim() !='' ? `ex) ${field2.example}` :'';
                });
            }else if(field.data){
                field.data.forEach((field2, index2) => {
                    responseStartRow++;
                    let rownum2 = rownum + index2 + 1;
                    sheet.getCell(`K${rownum2}`).value = field2.description;
                    sheet.getCell(`M${rownum2}`).value = field2.field;
                    sheet.getCell(`N${rownum2}`).value = field2.type;
                    sheet.getCell(`Q${rownum2}`).value = field2.example && field2.example.trim() !='' ? `ex) ${field2.example}` :'';
                });
            }
        });

        // Response String
        let responseBody = '';
        if(data.responseType == 'Integer'){
            responseBody = 0;
        }else if(data.responseType == 'String'){
            responseBody = "";
        }else{
            const jsonData = reduceJson(data.responseData);
            responseBody = jsonData &&  data.responseType.startsWith('List') ? [jsonData]:jsonData;
        }
        const responseJsonData = {
            header: {
                "code": `I00001${responseCdType}`,
                "message": "정상적으로 처리 되었습니다.",
                "origin": null,
            },
            body : responseBody
        }
        responseDataString = JSON.stringify(responseJsonData, null, 4);
        sheet.getCell(`J${dataEndRow + 3}`).value = responseDataString;
    }
}


async function updateExcelTemplateList(apiList) {
    if (!fs.existsSync(templatePath)) {
        console.error("❌ 템플릿 파일이 존재하지 않습니다:", templatePath);
        return;
    }
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);

    const templateSheet = workbook.getWorksheet(TEMPLATE_SEET_NO); 

    let i = 1;
    for (const data of apiList) {
        try {
            // 새로운 시트 생성 (API 이름 기반)
            i++;
            const sheet = workbook.addWorksheet(data.interfaceId);
            // 행 & 열 구조 복사 (스타일 포함)
            templateSheet.eachRow((row, rowNumber) => {
                const newRow = sheet.getRow(rowNumber);
                row.eachCell((cell, colNumber) => {
                    newRow.getCell(colNumber).value = cell.value; // 값 복사
                    newRow.getCell(colNumber).style = cell.style; // 스타일 복사
                });
                newRow.height = row.height; // 행 높이 유지
            });
    
            // 열 너비 복사
            templateSheet.columns.forEach((col, index) => {
                if (col.width) {
                    sheet.getColumn(index + 1).width = col.width;
                }
            });
    
            // 병합된 셀 정보 복사
            if (templateSheet.model.merges) {
                templateSheet.model.merges.forEach((merge) => {
                    sheet.mergeCells(merge);
                });
            }
    
            drawCellData(sheet, data);
            
        } catch (error) {
            
        }
    }
    
    // 🔹 파일 저장
    await workbook.xlsx.writeFile(outputPath);
    console.log(`✅ 엑셀 업데이트 완료: ${outputPath}`);
}

// 🔹 기존 엑셀 파일을 로드하고 데이터 채우기
async function updateExcelTemplate(data) {
    if (!fs.existsSync(templatePath)) {
        console.error("❌ 템플릿 파일이 존재하지 않습니다:", templatePath);
        return;
    }
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);
    const sheet = workbook.getWorksheet(TEMPLATE_SEET_NO); 

    drawCellData(sheet, data);
    
    // 🔹 파일 저장
    await workbook.xlsx.writeFile(outputPath);
    console.log(`✅ 엑셀 업데이트 완료: ${outputPath}`);
}

module.exports = { updateExcelTemplate , updateExcelTemplateList};



