/* eslint-env node */
/* eslint-disable no-console */
const axios = require('axios');
const styleToObject = require('style-to-object');
const cheerio = require('cheerio');
const fs = require('fs/promises');

async function makeReactLayout(options = {}) {
    options = Object.assign({}, {
        siteUrl: 'https://www.jenkins.io/',
        githubBranch: 'master',
        reportAProblemTemplate: '',
        headerUrl: process.env.HEADER_FILE || 'https://www.jenkins.io/template/index.html',
        extraCss: []
    }, options);
    const manifestUrl = new URL('/site.webmanifest', options.headerUrl).toString();

    if (!options.headerUrl) {
        return null;
    }

    const jsxLines = [
        'import React from \'react\';',
        'import {useStaticQuery, graphql} from \'gatsby\';',
        'import {Helmet} from \'react-helmet\';',
        // 'import {SiteVersion, ReportAProblem, ImproveThisPage} from \'@halkeye/jenkins-io-react\';',
        'import \'./layout.css\';',
    ];

    const cssLines = [].concat(options.extraCss);

    console.info(`Downloading header file from '${options.headerUrl}'`);
    const parsedHeaderUrl = new URL(options.headerUrl);
    const baseUrl = `${parsedHeaderUrl.protocol}//${parsedHeaderUrl.hostname}${parsedHeaderUrl.port ? `:${parsedHeaderUrl.port}` : ''}`;
    const content = await axios
        .get(options.headerUrl)
        .then((results) => {
            if (results.status !== 200) {
                throw results.data;
            }
            return results.data;
        });

    const $ = cheerio.load(content, {decodeEntities: false});
    $('nav .active.nav-item').removeClass('active'); // remove highlighted link
    if (options.siteUrl) {
        $(`.nav-item a[href*="${options.siteUrl}"]`).parent('.nav-item').addClass('active');
        $(`.nav-link[href*="${options.siteUrl}"]`).attr('href', '/');
    }
    $('img, script').each(function () {
        const src = $(this).attr('src');
        if (!src) {return;}
        if (src.startsWith('/')) {
            $(this).attr('src', `${baseUrl}${src}`);
        } else {
            $(this).attr('src', src.replace('https://jenkins.io', baseUrl).replace('https://www.jenkins.io', baseUrl));
        }
    });
    $('a, link').each(function () {
        const href = $(this).attr('href');
        if (!href) {return;}
        if (href.startsWith('/')) {
            $(this).attr('href', `${baseUrl}${href}`);
        } else {
            $(this).attr('href', href.replace('https://jenkins.io', baseUrl).replace('https://www.jenkins.io', baseUrl));
        }
    });
    // remove canonical as we add our own
    $('link[rel="canonical"]').remove();
    // Even though we're supplying our own this one still causes a conflict.
    $('link[href$="/css/font-icons.css"]').remove();
    // Prevents: Access to resource at 'https://jenkins.io/site.webmanifest' from origin 'https://plugins.jenkins.io' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.
    $('link[href$="site.webmanifest"]').attr('href', '/site.webmanifest');
    // lets get rid of all the head tags since we are populating them with the SEO component
    $('meta[content*="{{"]').remove();
    //remove title as we replace it most of the time. When we don't we dont want replaceme
    $('title').remove();
    $('head').append('<style>{`html { min-height:100%; position: relative; }`}</style>');

    $(`.nav-link[href="${options.siteUrl}"]`).attr('href', '/');
    $('#grid-box').empty();
    $('#grid-box').append('{children}');
    if (process.env.NETLIFY) {
        $('#footer .col-md-4').prepend('<div class="mb-3"><a href="https://www.netlify.com"><img src="https://www.netlify.com/img/global/badges/netlify-color-accent.svg" alt="Deploys by Netlify" /></a></div>');
    }
    $('#footer .col-md-4').prepend($('<p class="box">').append('<ImproveThisPage />').append('<ReportAProblem />'));
    // $('#creativecommons').append('<SiteVersion />');
    $('link[rel="stylesheet"]').each((_, elm) => {
        elm = $(elm);
        cssLines.push(`@import url('${elm.attr('href')}');`);
        elm.remove();
    });
    $('.searchbox').remove();
    $('script[src*="docsearch"]').remove();
    $('script:contains("docsearch")').remove();
    $('script:contains("google-analytics.com")').remove();

    const keyConversion = {
        class: 'className',
        'charSet': 'charset',
        'http-equiv': 'httpEquiv',
        'stop-color': 'stopColor',
        'crossorigin': 'crossOrigin',
        'lineargradient': 'linearGradient',
        'gradienttransform': 'gradientTransform',
        'gradientunits': 'gradientUnits',
        'viewbox': 'viewBox',
        'xlink:href': 'xlinkHref',
        'xmlns:xlink': 'xmlnsXlink',
        'nomodule': 'noModule',
    };

    const nodeConversions = {
        'lineargradient': 'linearGradient',
        'gradienttransform': 'gradientTransform',
    };

    const handleNode = (node, indent = 0) => {
        const prefix = ''.padStart(6 + indent);

        if (node.name) {
            node.name = nodeConversions[node.name] || node.name;
        }

        if (node.name === 'link' && node.attribs && node.attribs.rel === 'stylesheet') {
            delete node.attribs.crossorigin;
            node.attribs.type = 'text/css';
            node.attribs.media = 'all';
        }
        let attrs = Object.entries(node.attribs || {}).map(([key, val]) => {
            key = keyConversion[key] || key;
            if (key === 'style') {
                return `${key}={${JSON.stringify(styleToObject(val))}}`;
            }
            return `${key}=${JSON.stringify(val)}`;
        }).join(' ');
        if (node.name === 'script') {
            const text = node.children.map(child => {
                if (child.type === 'text') {
                    return child.data;
                }
                throw new Error(`not sure how to handle ${child.type}`);
            });
            if (text && text.length) {
                attrs = `${attrs} dangerouslySetInnerHTML={{__html: ${JSON.stringify(text)}}}`;
            }
            jsxLines.push(`${prefix}<${node.name} ${attrs} />`);
            return;
        } else if (node.type === 'comment') {
            return;
        } else if (node.type === 'text') {
            const text = node.data.replace('\u00A0', '&nbsp;');
            jsxLines.push(`${prefix}${text}`);
        } else if (node.children && node.children.length) {
            jsxLines.push(`${prefix}<${node.name} ${attrs}>`);
            node.children.forEach(child => handleNode(child, indent + 2));
            jsxLines.push(`${prefix}</${node.name}>`);
        } else {
            if (!node.name) {
                console.log(node);
            }
            if (node.name === 'siteversion') {
                throw new Error('Site Version');
                // jsxLines.push(`${prefix}<SiteVersion buildTime={buildTime} githubRepo={githubRepo} />`);
            } else if (node.name === 'improvethispage') {
                throw new Error('Improve This Page');
                // jsxLines.push(`${prefix}<ImproveThisPage sourcePath={sourcePath} githubRepo={githubRepo} />`);
            } else if (node.name === 'reportaproblem') {
                jsxLines.push(`${prefix}<ReportAProblem sourcePath={sourcePath} githubRepo={githubRepo} reportAProblemTemplate={reportAProblemTemplate} />`);
            } else if (node.name === 'jio-navbar') {
                jsxLines.push(`<jio-navbar className="fixed-nav" property=${JSON.stringify(options.siteUrl)}></jio-navbar>`);
            } else if (node.name === 'jio-footer') {
                jsxLines.push(`<jio-footer githubRepo={sourcePath ? githubRepo : ''} property=${JSON.stringify(options.siteUrl)} sourcePath={sourcePath} githubBranch=${JSON.stringify(options.githubBranch)} reportAProblemTemplate=${JSON.stringify(options.reportAProblemTemplate)}></jio-footer>`);
            } else {
                jsxLines.push(`${prefix}<${node.name} ${attrs} />`);
            }
        }
    };

    jsxLines.push('export default function Layout({ children, id, sourcePath}) {');
    jsxLines.push(`   const {site: { buildTime, siteMetadata: { githubRepo, siteUrl }}} = useStaticQuery(graphql\`
        query {
            site {
                buildTime
                siteMetadata {
                    githubRepo
                    siteUrl
                }
            }
        }
    \`);`);
    jsxLines.push('  return (');
    jsxLines.push('    <div id={id}>');
    jsxLines.push('      <Helmet>');
    $('head').children(':not(link[rel="stylesheet"])').each((_, child) => handleNode(child, 2));
    $('head').children('link[rel="stylesheet"]').each((_, child) => handleNode(child, 2));
    $('head').children('script').each((_, child) => handleNode(child, 2));
    jsxLines.push('      </Helmet>');
    $('body').children(':not(script)').each((_, child) => handleNode(child, 0));
    jsxLines.push('      <Helmet>');
    $('body').children('script').each((_, child) => handleNode(child, 2));
    jsxLines.push('      </Helmet>');
    jsxLines.push('    </div>');
    jsxLines.push('  );');


    jsxLines.push('}');


    console.info(`Downloading site manifest file from '${manifestUrl}'`);
    const manifest = await axios
        .get(manifestUrl)
        .then((results) => {
            if (results.status !== 200) {
                throw results.data;
            }
            results.data.icons.forEach(icon => {
                icon.src = new URL(icon.src, manifestUrl).toString();
            });
            results.data.start_url = options.siteUrl || 'https://www.jenkins.io';
            return JSON.stringify(results.data);
        });

    return {
        manifest: manifest,
        jsxLines: jsxLines.map(str => str.trimEnd()).filter(Boolean).join('\n'),
        cssLines: cssLines.map(str => str.trimEnd()).filter(Boolean).join('\n')
    };
}

async function saveReactLayout({jsxLines, cssLines, manifest}) {
    if (manifest) {
        await fs.mkdir('static', {recursive: true});
        await fs.writeFile('./static/site.webmanifest', manifest);
    }
    if (jsxLines) {
        await fs.writeFile('./src/layout.jsx', jsxLines);
    }
    if (cssLines) {
        await fs.writeFile('./src/layout.css', cssLines);
    }
}

exports.makeReactLayout = makeReactLayout;
exports.saveReactLayout = saveReactLayout;

if (require.main === module) {
    makeReactLayout().then(saveReactLayout).catch(console.error);
}
