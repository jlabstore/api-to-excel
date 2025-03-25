const fs = require("fs");
const path = require("path");
const config = require("../config.json");

// 특정 디렉토리 내에서 *.java 파일 찾기
function findJavaFiles(dir) {
    return fs.readdirSync(dir)
        .filter(file => file.endsWith("Dto.java"))
        .map(file => path.join(dir, file));
}

// 파일 읽기
function readFile(filePath) {
    return fs.readFileSync(filePath, "utf-8");
}

// 파일 저장
function writeFile(filePath, content) {
    fs.writeFileSync(filePath, content, "utf-8");
}

// 🔹 특정 API가 있는지 검사
function checkApiInFile(filePath, url) {
    const content = fs.readFileSync(filePath, 'utf8');
    const regex = new RegExp(`@\\w+Mapping\\("${url}"\\)`, "g");
    return regex.test(content);
}

// 데이터 json으로 저장  
function writerFileJson(data, fileName){
    // 2. JSON 문자열로 변환
    const jsonString = JSON.stringify(data, null, 2);

    // 3. 파일로 저장
    fs.writeFile(`data/${fileName}.json`, jsonString, "utf8", (err) => {
    if (err) {
        console.error("파일 저장 실패:", err);
    } else {
        console.log("JSON 파일이 성공적으로 저장되었습니다!");
    }
    });
}

function readFileJson(fileName){
    let jsonData = null;
    try {
        // JSON 파일 읽기
        jsonData = JSON.parse(fs.readFileSync(`data/${fileName}.json`, 'utf8'));
    } catch (error) {}

    return jsonData;
}


// 특정 폴더의 모든 Java 파일 찾기 (하위 폴더 포함)
function findJavaFilesRecursiveAll(dir, fileList = []) {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            findJavaFilesRecursiveAll(fullPath, fileList); // 재귀 호출로 하위 폴더 탐색
        } else if (file.endsWith("Controller.java")) {
            fileList.push(fullPath);
        }
    });
    return fileList;
}

// 특정 폴더의 모든 Java 파일 찾기 (하위 폴더 포함)
function findJavaFilesRecursive(dir, fileList = [], fileName='', isFind = false, url = '') {
    if(!isFind){
        const files = fs.readdirSync(dir);
    
        files.forEach(file => {
            const fullPath = path.join(dir, file);
            if (fs.statSync(fullPath).isDirectory()) {
                findJavaFilesRecursive(fullPath, fileList, fileName, isFind, url); // 재귀 호출로 하위 폴더 탐색
            } else if ( (fileName == 'Controller' &&  file.endsWith(fileName+".java"))
                    || path.basename(file) == fileName+".java" ) {
                if(url != ''){
                    if( checkApiInFile(fullPath, url)){
                        isFind = true;
                        fileList.push(fullPath);
                    }
                }else{
                    fileList.push(fullPath);
                }
            }
        });
    }
    return fileList;
}



function findFileInControllers(rootDir, targetFile) {
    let folderIndex = 0;

    function searchControllers(dir) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);

            if (entry.isDirectory() && entry.name.toLowerCase().includes('controller')) {
                folderIndex++; // controller 폴더 발견 시 증가
                const files = fs.readdirSync(fullPath);

                // 파일이 존재하면 즉시 반환 (탐색 중단)
                const fileIndex = files.indexOf(targetFile);
                if (fileIndex !== -1) {
                    return {
                        folderIndex,
                        fileIndex: fileIndex + 1,
                        folderPath: fullPath
                    };
                }
            } else if (entry.isDirectory()) {
                const result = searchControllers(fullPath); // 재귀 탐색
                if (result) return result; // 찾으면 즉시 반환
            }
        }
        return null;
    }

    return searchControllers(rootDir);
}

module.exports = { findJavaFiles, readFile, writeFile, checkApiInFile, findJavaFilesRecursive, findFileInControllers, findJavaFilesRecursiveAll, writerFileJson, readFileJson};
