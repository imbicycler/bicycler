import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { marked } from 'marked'
import { mkdirp } from 'mkdirp'

const readFile = (filename) => {
    const rawFile = fs.readFileSync(filename, 'utf8')
    const parsed = matter(rawFile)
    const html = marked(parsed.content)
    
    return { ...parsed, html }
}

const templatize = (template, { title, date, content }) =>
    template
        .replace(/{{ content }}/g, content)
        .replace(/{{ title }}/g, title)
        .replace(/{{ date }}/g, date)

const getOutputFilename = (filename, outPath) => {
    const basename = path.basename(filename)
    const newFilename = basename.substring(0, basename.length - 3) + '.html'
    const outFile = path.join(outPath, newFilename)
    return outFile
}

const saveFile = (filename, content) => {
    const dir = path.dirname(filename)
    mkdirp.sync(dir)
    fs.writeFileSync(filename, content)
}

const processFile = (filename, template, outPath) => {
    const file = readFile(filename)
    const outFilename = getOutputFilename(filename, outPath)
    const templatized = templatize(template, {
        date: file.data.date,
        title: file.data.title,
        content: file.html
    })
    saveFile(outFilename, templatized)
}

const template = fs.readFileSync(path.join(path.resolve(), 'src/template.html'), 'utf8')
const filename = path.join(path.resolve(), 'src/241009 마크다운 문법 소개.md')
const outPath = path.join(path.resolve(), 'dist')

processFile(filename, template, outPath)