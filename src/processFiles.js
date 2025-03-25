const path = require("path");
const config = require("../config.json");
const {findJavaFilesRecursive, findJavaFilesRecursiveAll, writerFileJson, readFileJson } = require("./utils");
const {parseJavaControllerApiList, parseJavaDto } = require("./parse");

const INPUT_DIR =  config.inputDirectory;
const TARGET_FILE = config.targetFile;
const BASIC_TYPES = ["String", "Integer", "Long", "Double", "Float", "Boolean", "Character", "Byte", "Short"];


const NDRS_SYSTEM = ["ndrs-common", "ndrs-study", "ndrs-sales", "ndrs-push", "ndrs-file", "ndrs-billing"];
const NDRS_ADMIN_SYSTEM = ["ndrs-admin-common", "ndrs-admin-prd", "ndrs-admin-mbr", "ndrs-admin-chn"];
const NDRS_BILLING_SYSTEM = ["ndrs-billing-admin"];
const SYSTEM_CATEGORIES = {
    "Dreams": NDRS_SYSTEM,
    "Dreams Admin": NDRS_ADMIN_SYSTEM,
    "Billing Admin": NDRS_BILLING_SYSTEM
};
const ALL_SYSTEM = [...NDRS_SYSTEM, ...NDRS_ADMIN_SYSTEM, ...NDRS_BILLING_SYSTEM];


const targetSystemName = getSystemName(INPUT_DIR, ALL_SYSTEM);
const sourceSystemName = findSystemCategory(targetSystemName);
const interfaceIdPre = targetSystemName ? targetSystemName.toUpperCase().replace(/-/g, '_') + '_' : 'NDRS_';

//interface json data
const interfacJsonFileName = `${targetSystemName}-data`;
const interfaceJsonData = readFileJson(interfacJsonFileName);


function getSystemName(text, targets){
    // 정규식 생성 (|를 사용하여 여러 개의 단어 탐색)
    const regex = new RegExp(`(${targets.join("|")})`, "g");

    // 매칭된 값 찾기
    const matches = text.match(regex);
    return matches ? matches[0] : '';
}


function setSystemName(data){
    if(data){
        data.sourceSystemName = sourceSystemName;
        data.targetSystemName = targetSystemName;
    }
}

function findSystemCategory(text) {
    const foundCategories = [];

    for (const [category, systems] of Object.entries(SYSTEM_CATEGORIES)) {
        if (systems.some(system => text.includes(system))) {
            foundCategories.push(category);
        }
    }

    return foundCategories.length > 0 ? foundCategories[0] : ["Dreams"];
}


function getDtoData (dtoType, isRequest=false){
    let dtoData = [];
    let dtoTypeT = null;
    if(dtoType.startsWith('List')){
        const match = dtoType.match(/List<(\w+)>/);
        if (match && !BASIC_TYPES.includes(match[1])) {
            dtoType = match[1];
        }
    }else if(/^[A-Za-z_][A-Za-z0-9_]*<[A-Za-z_][A-Za-z0-9_]*>$/.test(dtoType)){// Object<T> 타입 확인 ex) AgntDto<ElvlProdNidxCstatDto>
        const regex = /([^<]+)<([^>]+)>/;
        const match = dtoType.match(regex);
        if (match) {
            dtoType = match[1]; 
            dtoTypeT = match[2];
        }
    }
    const dtoFiles =  findJavaFilesRecursive(INPUT_DIR, [], dtoType, false);
    if(dtoFiles){
        dtoData = parseJavaDto(dtoFiles[0]);
        if(dtoTypeT != null){
            dtoData.forEach(dto=>{
                if(dto.type == 'T'){
                    dto.type = dtoTypeT;
                }else{
                    dto.type = dto.type.replace(/<T>/g, `<${dtoTypeT}>`)
                }
            })
        }
        if(isRequest) dtoData = dtoData.filter(e=>e.hidden != 'Y');
        if(dtoData){
            dtoData.forEach(dto=>{
                if(dto.type.startsWith('List')){
                    const match = dto.type.match(/List<(\w+)>/);
                    if (match) {
                        const listDto = match[1];
                        if (!BASIC_TYPES.includes(listDto)) {
                            const listDtoFiles =  findJavaFilesRecursive(INPUT_DIR, [], listDto, false);
                            if(listDtoFiles){
                                const listDtoData = parseJavaDto(listDtoFiles[0]);
                                if(listDtoData){
                                    dto.listData = listDtoData;
                                }
                            }
                        }
                    }
                }else if(!BASIC_TYPES.includes(dto.type)){
                    const childDto =  findJavaFilesRecursive(INPUT_DIR, [], dto.type, false);
                    if(childDto){
                        const childDtoData = parseJavaDto(childDto[0]);
                        if(childDtoData){
                            dto.data = childDtoData;
                        }
                    }

                }
            })
        }
    }
    return dtoData;
}



function processJavaFiles() {
    let resultData = null;
    const javaFiles = findJavaFilesRecursive(INPUT_DIR, [], TARGET_FILE, false); // 하위 폴더까지 포함

    let cnt = 1;
    javaFiles.forEach(file => {
        let apiList = parseJavaControllerApiList(file);
        if(apiList){
            apiList.forEach(data=>{
                // console.log("------------------------------------------------" + data.url + "------------------------------------------------")
                if(data.requestType){
                    data.requestData = getDtoData(data.requestType, true);
                }
    
                if(data.responseType){
                    data.responseData = getDtoData(data.responseType);
                }
                setSystemName(data);
    
                let interfaceId = '';
                if(interfaceJsonData && interfaceJsonData.length > 0){
                    const item = interfaceJsonData.find(item => item.url === data.url && item.method === data.method);
                    if(item && item.interfaceId && item.interfaceId != ''){
                        interfaceId = item.interfaceId;
                    }
                }
                
                if( interfaceId == ''){
                    interfaceId = interfaceIdPre + String(cnt).padStart(3, '0');
                    cnt++;
                }
                data.interfaceId = interfaceId;
            })

        }
        resultData = apiList;
    });
    return resultData;
}


function processJavaFilesAll() {
    let resultData = [];
    const javaFiles = findJavaFilesRecursiveAll(INPUT_DIR, []);

    let cnt = 1;
    console.log('Controller 총 갯수 :: ', javaFiles.length)
    javaFiles.forEach((file, index) => {
        let apiList = parseJavaControllerApiList(file);
        console.log('Controller ::', index, file, '(' + apiList.length + ')')
        if(apiList){
            apiList.forEach(data=>{
                if(data.requestType){
                    data.requestData = getDtoData(data.requestType, true);
                }
    
                if(data.responseType){
                    data.responseData = getDtoData(data.responseType);
                }
                setSystemName(data);
    
                data.index = String(cnt).padStart(3, '0');
                data.interfaceId = interfaceIdPre + String(cnt).padStart(3, '0');
                cnt++;
            })
            resultData = resultData.concat(apiList);
        }
    });
    console.log('API 총 갯수 :: ', cnt)
    try {
        writerFileJson(resultData, interfacJsonFileName);
    } catch (error) {}
    
    return resultData;
}


module.exports = { processJavaFiles, processJavaFilesAll };
