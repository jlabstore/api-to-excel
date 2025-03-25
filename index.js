const { processJavaFile, processJavaFiles, processJavaFilesAll } = require("./src/processFiles");
const { updateExcelTemplate, updateExcelTemplateList } = require("./src/excelWriter");
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
    // else{
    //     // Java 파일 처리 실행
    //     const data = processJavaFile();
    //     console.log("API :: ", data)
    //     if(data){
    //         // 엑셀 추출
    //         updateExcelTemplate(data)
    //     }
    // }
}

main();


console.log("✅ Java 파일 확인 완료!");
