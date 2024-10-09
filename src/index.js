import fs from 'fs'
import path from 'path'

const readFile = (filename) => {
    const rawFile = fs.readFileSync(filename, 'utf8')
    console.log(rawFile)
}

readFile(path.join(path.resolve(), 'src/241009 마크다운 문법 소개.md') )
