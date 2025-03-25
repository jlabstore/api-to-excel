const { processJavaFiles, processJavaFilesAll } = require("./src/processFiles");
const { updateExcelTemplateList } = require("./src/excelWriter");
const config = require("./config.json");

const targetType = config.targetType;

function main() {
    if(targetType === 'ALL'){
        // Java 파일 처리 실행
        const apiList = processJavaFilesAll();
        // console.log("ALL API LIST :: ", apiList)
        if(apiList){
            // 엑셀 추출
            updateExcelTemplateList(apiList)
        }
    }else{ //FILE
        // Java 파일 처리 실행
        const apiList = processJavaFiles();
        console.log("API LIST :: ", apiList)
        if(apiList){
            // 엑셀 추출
            updateExcelTemplateList(apiList)
        }
    }
}

main();


console.log("✅ Java 파일 확인 완료!");
