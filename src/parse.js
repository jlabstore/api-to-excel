const fs = require("fs");
const config = require("../config.json");
const {findJavaFilesRecursive, readFileJson} = require("./utils");


// 소스 경로
const INPUT_DIR =  config.inputDirectory;

// 메뉴 정보 Json
const menuJson = readFileJson('MENU');
// pageDto Json  (pageDto는 Core 파일이라 직접 명시)
const pageDtoJson = readFileJson('PAGE_DTO');


// ============================================= 정규식 SATRT =================================================

// API 상위 URL (@RequestMapping)
const PARENT_PATH_REGEX = /@RequestMapping\s*\(\s*(?:value\s*=\s*)?\s*"([^"]+)"\s*\)/;

// API method
const METHOD_REGEX = /@(Get|Post|Put|Delete)Mapping/;
// API 인터페이스 명 (@Operation(summary))
const SUMMARY_REGEX = /@Operation\s*\([^)]*summary\s*=\s*"([^"]*)"/;
// API 인터페이스 개요 (@Operation(description))
const DESCRIPTIN_REGEX = /@Operation\s*\([^)]*description\s*=\s*"([^"]*)"/;

// API Response Type (DrsResponseEntity<?>)
const RESPONSE_TYPE_REGEX = /public\s+DrsResponseEntity<(.*?)>\s+/;

// API Request RequestBody Type (@RequestBody )
const REQUEST_BODY_TYPE_REGEX = /@RequestBody\s*\(?\)?\s+(?:@Valid\s+)?(\S+)/;
// API Request ModelAttribute Type (@ModelAttribute )
const REQUEST_MDELATTRIBUTE_TYPE_REGEX = /@ModelAttribute\s+(.*?)\s+/;

// API Request Path 파라미터 (@Parameter(...) @PathVariable(...))
const PARAM_REGEX = /@Parameter\s*\(\s*(?:name\s*=\s*"([^"]*)",\s*)?description\s*=\s*"([^"]*)"(?:,\s*example\s*=\s*"([^"]*)")?(?:,\s*required\s*=\s*(true|false))?\s*\)\s*(?:@PathVariable\s*)?([\w<>]+)\s+(\w+)/g;
// API Request Query 파라미터 (@Parameter(...) @RequestParam(...))
const REQUEST_PARAM_REGEX = /@Parameter\s*\(\s*description\s*=\s*"([^"]*)"(?:,\s*example\s*=\s*"([^"]*)")?\)\s*\n?\s*@RequestParam(?:\s*\(\s*(?:name\s*=\s*|value\s*=\s*)?"?([^"]*)"?[^)]*\))?\s*(\w+)\s+(\w+)/gs;


// DTO 데이터 추출을 위한 정규식
// const DTO_FIELD_REGEX = /@Schema\s*\(\s*description\s*=\s*"([^"]*)"(?:,\s*example\s*=\s*"([^"]*)")?(?:,\s*hidden\s*=\s*(true|false))?\s*\)\s*(?:@\w+\([^)]*\)\s*)*\s*(?:private|protected|public)\s+([\w<>]+)\s+(\w+)(?:\s*=\s*[^;]+)?;/g;

// ============================================= 정규식 END =================================================



// API method 가져오기
const getApiMethod = (line) => {
    const match = line.match(METHOD_REGEX);
    return match ? match[1] : null;  // Get, Post, Put, Delete 중 매칭된 값 반환
};


const getPathVariableFields =(url)=> {
    try {
        const dynamicFieldRegex = /\{([^}]+)\}/g;
        const matches = [...url.matchAll(dynamicFieldRegex)];
        return matches.map(match => match[1]);
    } catch (error) {
        return '';
    }
}

const extractApiParams=(javaCode)=> {
    const PARAMETER_REGEX = /@Parameter\s*\(\s*name\s*=\s*"([^"]*)",\s*description\s*=\s*"([^"]*)".*?\)/g;
    const REQUEST_PARAM_REGEX = /(?:@Valid\s+)?@RequestParam\s*\(\s*(?:value\s*=\s*)?"([^"]*)".*?\)\s*(\w+)\s+(\w+)/g;

    let parameters = [];
    let paramMap = {};

    // 1️⃣ @Parameter에서 name과 description 추출
    let match;
    while ((match = PARAMETER_REGEX.exec(javaCode)) !== null) {
        paramMap[match[1]] = { description: match[2], field: match[1] };
    }

    // 2️⃣ @RequestParam이 있는 경우만 데이터로 변환
    while ((match = REQUEST_PARAM_REGEX.exec(javaCode)) !== null) {
        const [, field, type] = match;

        // @Parameter에 있는 경우 추가, 없으면 기본값 사용
        if (paramMap[field]) {
            paramMap[field].type = type;
            paramMap[field].example = "";
            paramMap[field].hidden = "N";
            parameters.push(paramMap[field]);
        } else {
            // @Parameter가 없지만 @RequestParam이 있는 경우도 추가
            parameters.push({
                description: "",
                field: field,
                type: type,
                example: "",
                hidden: "N"
            });
        }
    }
    return parameters;
}

const matchJavaBlock =(match, url, index)=>{
    const methodBlock = match[0];
    const method = getApiMethod(methodBlock)
    const summaryMatch = SUMMARY_REGEX.exec(methodBlock);
    const descriptionMatch = DESCRIPTIN_REGEX.exec(methodBlock);
    const responseTypeMatch = RESPONSE_TYPE_REGEX.exec(methodBlock);
    const requestTypeMatch = REQUEST_BODY_TYPE_REGEX.exec(methodBlock);
    const requestModelTypeMatch = REQUEST_MDELATTRIBUTE_TYPE_REGEX.exec(methodBlock);
    const requestPathData = [];
    let menuData = '';

    try {
        if(menuJson){
            const items= menuJson.filter(item => item.api_uri === url && item.api_mthd.toUpperCase() === method.toUpperCase() )
            if(items && items.length > 0 ){
                menuData = items.map(item => item.array_to_string).join(', ');
            }else{
                const items= menuJson.filter(item => (item.api_uri).includes(url) )
                if(items && items.length > 0){
                    menuData = items[0].array_to_string;
                }
            }
        }
    } catch (error) {}

    //PathParam
    const dynamicFieldRegex = /\{([^}]+)\}/g;
    if(url && dynamicFieldRegex.test(url)){
        try {
            const pathVariableFields = getPathVariableFields(url);

            if(pathVariableFields && pathVariableFields.length > 0){
                const paramDatas = [];
                let match2;
                while ((match2 = PARAM_REGEX.exec(methodBlock)) !== null) {
                    paramDatas.push({
                        description: match2[2]?match2[2]:'',
                        field: match2[6] || match2[1] ?  match2[6] || match2[1] : '', // name이 없으면 변수명 사용
                        type: match2[5]?match2[5]:'', // 타입 (String 등)
                        example: match2[3]?match2[3]:'',
                        hidden: 'N'
                    });
                }
                pathVariableFields.forEach(field=>{
                    const paramData = paramDatas.find(e=>e.field == field);
                    if(paramData){
                        requestPathData.push(paramData)
                    }else{
                        requestPathData.push({
                            description: '',
                            field: field,
                            type: 'String',
                            example: '',
                            hidden: 'N'
                        })
                    }
                });

            }
        } catch (error) {}
    }


    //RequestParam
    let requestMatch;
    let requestParamData = [];
    while ((requestMatch = REQUEST_PARAM_REGEX.exec(methodBlock)) !== null) {
        const [, description, example, paramName, type, field] = requestMatch;
        requestParamData.push({
          description,
          field: paramName || field, // name이 없으면 변수명 사용
          type,
          example: example || "", // example이 없으면 빈 값
          hidden: "N"
        });
    }
    if(requestParamData.length == 0){
        const paramData =  extractApiParams(methodBlock);
        if(paramData && paramData.length > 0){
            requestParamData = paramData;
        }
    }
    
    return {
        index: index, 
        url: url,
        method: method.toUpperCase(),
        summary: summaryMatch ? summaryMatch[1] : '',
        description: descriptionMatch ? descriptionMatch[1] : '',
        responseType: responseTypeMatch ? responseTypeMatch[1] : '',
        requestType: requestTypeMatch ? requestTypeMatch[1] : requestModelTypeMatch ? requestModelTypeMatch[1] : '',
        requestPathData: requestPathData,
        requestParamData : requestParamData,
        menuData : menuData,
    }
}

// API URl 가져오기
const extractUrls = (content) => {
    // 정규식 패턴
    const regex = /@(?:Get|Post|Put|Delete)Mapping\s*\(\s*(?:value\s*=\s*)?\{?\s*((?:"[^"]*"\s*,?\s*)+)\s*\}?\s*\)?/g;
    const urls = [];

    let match;
    while ((match = regex.exec(content)) !== null) {
        if (match[1]) {
            // 쉼표로 구분된 여러 개의 URL을 추출하고, 큰따옴표 제거
            if(match[1].match(/"([^"]+)"/g)){
                match[1]
                    .match(/"([^"]+)"/g) // 모든 큰따옴표로 감싸진 문자열 찾기
                    .map(url => url.replace(/"/g, '').trim()) // 큰따옴표 제거 및 공백 정리
                    .forEach(url => urls.push(url));

            }
        }
    }
    return urls;
};


function extractAfterClassDeclaration(javaCode) {
    const classBodyRegex = /public class \w+\s*([\s\S]*)/;

    const match = javaCode.match(classBodyRegex);
    return match ? match[1].trim() : null;
}

const parseJavaControllerApiList = (filePath) => {
    const resultData = [];
    const content = fs.readFileSync(filePath, 'utf8');

    const apiRegex = /(?:^\s*(?:\/\*\*[\s\S]*?\*\/)\s*\n)?(?:^\s*@Operation\([\s\S]*?\)\s*\n)?(?:^\s*\/\*\*[\s\S]*?\*\/\s*\n)?^\s*(@(?:Get|Post|Put|Delete)Mapping[^\n]*\n(?:[\s\S]*?))(?=^\s*(?:@(?:Get|Post|Put|Delete)Mapping|\/\*\*|\s*}\s*$|\Z))/gm;

    const matches = [...extractAfterClassDeclaration(content).matchAll(apiRegex)];

    const parentPathMatch = content.match(PARENT_PATH_REGEX);
    const parentPath = parentPathMatch && parentPathMatch[1] ? parentPathMatch[1] : '';

    matches.forEach((match, index) => {
        if (match) {
            // console.log('================================================================')
            // console.log(index,  match[2], match[0]); // index, url, block

            let url = '';
            const matchUrl = extractUrls(match[0]); // Url 가져오기
            if(matchUrl && matchUrl.length > 0){
                url = matchUrl[matchUrl.length-1]
            }

            let data = matchJavaBlock(match, parentPath + url, index+1);
            resultData.push(data);
        }
    });
    return resultData;
};





const parseJavaDto = (filePath, inExtends = true) => {
    const extractedData = [];
    if(filePath){
        // DTO 파일 읽기
        const content = fs.readFileSync(filePath, 'utf8');

        if(/extends\s+PageDto/.test(content)){
            extractedData.push(...pageDtoJson);
        };

        if(inExtends){
            const EXTENDS_REGEX = /extends\s+(\S+)/;
            const match2 = content.match(EXTENDS_REGEX);
    
            if (match2) {
                const dtoType = match2[1];
                const dtoFiles =  findJavaFilesRecursive(INPUT_DIR, [], dtoType, false);
                if(dtoFiles){
                    const extendsDtoData = parseJavaDto(dtoFiles[0], false);
                    if(extendsDtoData && extendsDtoData.length > 0){
                        extractedData.push(...extendsDtoData);
                    }
                }
            } 
        }
    
        const datas = parseDTO(content);
        if(datas){
            extractedData.push( ...datas);
        }
        // while ((match = DTO_FIELD_REGEX.exec(content)) !== null) {
        //     extractedData.push({
        //         description: match[1], // 필드 설명
        //         field: match[5], // 필드명
        //         type: match[4], // 필드 타입 (String, int, List<...> 등)
        //         example: match[2] || '', // 예제 값 (없으면 빈 문자열)
        //         hidden: match[3] === 'true' ? 'Y' : 'N' // hidden 여부 (true → Y, false 또는 없음 → N)
        //     });
        // }
    }
    return extractedData;
};


function parseDTO(dtoText) {
    const lines = dtoText.split("\n");
    const fields = [];
    let currentSchema = null;
  
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
  
      // @Schema가 있으면 저장 (다음 필드와 연결하기 위해)
      if (line.startsWith("@Schema")) {
        currentSchema = line;
        continue;
      }
  
      // private/protected/public 필드 탐색
      const fieldMatch = line.match(/(private|protected|public)\s+([\w<>]+)\s+(\w+)(?:\s*=\s*[^;]+)?;/);

      if (fieldMatch) {
        const [, , fieldType, fieldName] = fieldMatch;
        let description = "";
        let example = "";
        let hidden = "";
  
        // @Schema 정보를 추출 (이전 줄에서 발견된 경우)
        if (currentSchema) {
          const descMatch = currentSchema.match(/description\s*=\s*"([^"]*)"/);
          const exampleMatch = currentSchema.match(/example\s*=\s*"([^"]*)"/);
          const hiddenMatch = currentSchema.match(/hidden\s*=\s*"([^"]*)"/);
  
          if (descMatch) description = descMatch[1];
          if (exampleMatch) example = exampleMatch[1];
          if (hiddenMatch) hidden = hiddenMatch[1];
  
          // @Schema 사용 후 초기화
          currentSchema = null;
        }
  
        fields.push({
            description: description, // 필드 설명
            field: fieldName, // 필드명
            type: fieldType, // 필드 타입 (String, int, List<...> 등)
            example: example || '', // 예제 값 (없으면 빈 문자열)
            hidden: hidden === 'true' ? 'Y' : 'N' // hidden 여부 (true → Y, false 또는 없음 → N)
        });
      }
    }
  
    return fields;
  }

module.exports = {parseJavaControllerApiList, parseJavaDto};
