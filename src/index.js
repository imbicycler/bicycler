import fs from 'fs/promises'
import path from 'path'
import matter from 'gray-matter'
import { marked, Lexer } from 'marked'
import { mkdirp } from 'mkdirp'
import { glob } from 'glob'
import sharp from 'sharp'
import ejs from 'ejs'

const SRC_PATH = path.join(path.resolve(), 'src')
const SRC_NOTES_PATH = path.join(SRC_PATH, 'notes')
const OUT_PATH = path.join(path.resolve(), 'dist')
const OUT_NOTES_PATH = path.join(OUT_PATH, 'notes')

const NOTES_PATTERN = path.join(SRC_PATH, 'notes/**/*.md')

// 전역 변수 이름 변경
const noteInfos = [];

const findAssetReferences = (markdownContent) => {
    const tokens = Lexer.lex(markdownContent);
    const paths = [];
  
    const walkTokens = (tokens) => {
        tokens.forEach((token) => {
            if (token.type === 'image' || token.type === 'link') {
                if (token.href && token.href.includes('assets/')) {
                    paths.push(token.href);
                }
            } else if (token.tokens) {
                walkTokens(token.tokens);
            }
        });
    }
  
    walkTokens(tokens);
    return paths;
}

const getOutputFilename = (filename) => {
    const relativePath = path.relative(SRC_PATH, filename)
    const dirname = path.dirname(relativePath)
    const basename = path.basename(filename, '.md')
    return path.join(OUT_PATH, dirname, `${basename}.html`)
}

const saveFile = async (filename, content) => {
    const dir = path.dirname(filename)
    await mkdirp(dir)
    await fs.writeFile(filename, content)
}

const copyAssets = async (assetReferences, srcDir, destDir, content) => {
    let updatedContent = content;
    for (const ref of assetReferences) {
        const srcPath = path.join(SRC_NOTES_PATH, ref);
        const destPath = path.join(OUT_NOTES_PATH, ref);
        
        try {
            await mkdirp(path.dirname(destPath));
            
            const ext = path.extname(srcPath).toLowerCase();
            if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
                const webpDestPath = destPath.replace(ext, '.webp');
                await sharp(srcPath)
                    .resize({ width: 1200, withoutEnlargement: true })
                    .webp({ quality: 80 })
                    .toFile(webpDestPath);
                console.log(`Converted and copied asset: ${srcPath} -> ${webpDestPath}`);
                
                updatedContent = updatedContent.replace(ref, ref.replace(ext, '.webp'));
            } else {
                await fs.copyFile(srcPath, destPath);
                console.log(`Copied asset: ${srcPath} -> ${destPath}`);
            }
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.warn(`Asset file not found: ${srcPath}`);
            } else {
                console.error(`Error processing asset ${srcPath}:`, error);
            }
        }
    }
    return updatedContent;
}

const getTemplateFile = (layout) => {
    return path.join(SRC_PATH, 'notes', 'layouts', layout)
}

const formatDate = (date) => {
    const publishedDate = new Date(date)
    return `${publishedDate.getFullYear()}년 ${publishedDate.getMonth() + 1}월 ${publishedDate.getDate()}일`
}

const renderContent = async (content, data) => {
    if (data.layout) {
        const templateFile = getTemplateFile(data.layout)
        const template = await fs.readFile(templateFile, 'utf8')
        const html = marked(content)
        const formattedDate = formatDate(data.published)
        
        return ejs.render(template, {
            published: formattedDate,
            title: data.title,
            content: html,
            // views 디렉토리 경로 추가
            viewsPath: path.join(SRC_NOTES_PATH, 'views')
        }, {
            filename: templateFile
        })
    } else {
        return marked(content)
    }
}

const processFile = async (filename) => {
    const fileContent = await fs.readFile(filename, 'utf8')
    const { data, content: originalContent } = matter(fileContent)
    
    if (data.draft === false && !data.published) {
        throw new Error(`Error in ${filename}: Draft is false but no published date is set.`);
    }

    const noteInfo = {
        markdown: path.relative(SRC_NOTES_PATH, filename),
        html: path.relative(OUT_NOTES_PATH, getOutputFilename(filename)),
        ...data
    };

    noteInfos.push(noteInfo);

    const assetReferences = findAssetReferences(originalContent)
    const updatedContent = await copyAssets(assetReferences, SRC_PATH, OUT_PATH, originalContent)

    const renderedHtml = await renderContent(updatedContent, data)
    
    const outFilename = getOutputFilename(filename)
    await saveFile(outFilename, renderedHtml)
    console.log(`Processed: ${filename} -> ${outFilename}`)
}

const generateIndexPage = async (publishedNotes) => {
    const indexTemplatePath = path.join(SRC_NOTES_PATH, 'layouts', 'notes', 'index.html');
    const indexTemplate = await fs.readFile(indexTemplatePath, 'utf8');
    const renderedIndex = ejs.render(indexTemplate, 
        { 
            published: publishedNotes,
            // views 디렉토리 경로 추가
            viewsPath: path.join(SRC_NOTES_PATH, 'views')
        }, 
        {
            filename: indexTemplatePath
        }
    );

    const indexOutputPath = path.join(OUT_PATH, 'notes', 'index.html');
    await saveFile(indexOutputPath, renderedIndex);
    console.log(`Generated index page: ${indexOutputPath}`);
}

const logProcessingResults = (noteInfos, publishedNotes) => {
    console.log('Information for all processed notes:');
    console.log(JSON.stringify(noteInfos, null, 2));

    console.log('Published notes (sorted by date):');
    console.log(JSON.stringify(publishedNotes, null, 2));
}

const main = async () => {
    const markdownFilenames = await glob(NOTES_PATTERN)
    await Promise.all(markdownFilenames.map(processFile))
    console.log('All files processed successfully')
    
    const publishedNotes = noteInfos
        .filter(note => note.draft === false)
        .sort((a, b) => new Date(b.published) - new Date(a.published));

    await generateIndexPage(publishedNotes);
    logProcessingResults(noteInfos, publishedNotes);
}

main().catch(error => console.error('An error occurred during processing:', error));
