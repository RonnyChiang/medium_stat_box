const axios = require('axios');
const { GistBox } = require('gist-box');
const cheerio = require('cheerio');
const table = require('text-table');
const moment = require('moment');

require('dotenv').config();

const MEDIUM_API_BASE_URL =
  'https://api.rss2json.com/v1/api.json?rss_url=https://medium.com/feed/@';

const { GIST_ID, GH_PAT, MEDIUM_USER_NAME } = process.env;
const MAX_STR_LENGTH = 20;

if (!GIST_ID || !GH_PAT || !MEDIUM_USER_NAME)
  throw new Error('Get data failed');

async function getMediumStats() {
  let takenData = '';
  let result = [];
  try {
    const mediumRes = await axios.get(MEDIUM_API_BASE_URL + MEDIUM_USER_NAME);

    takenData = await Promise.all(
      mediumRes.data.items
        .slice(0, 3) // 3 stories
        .map(async (item) => {
          const res = await axios.get(item.guid); // story url
          const $ = cheerio.load(res.data);
          const commentCount = $('.pw-responses-count').text();
          return {
            title: item.title,
            date: item.pubDate,
            comments: commentCount ? commentCount : '0',
          };
        })
    );
  } catch (err) {
    throw new Error('catch data failed');
  }

  takenData.forEach((item) => {
    const day = new Date(item.date); // set date form

    // set title length
    let trimTitle = '';
    if (item.title.length > MAX_STR_LENGTH)
      trimTitle = item.title.slice(0, MAX_STR_LENGTH) + '...';
    else trimTitle = item.title;

    result.push([
      trimTitle,
      day.toLocaleDateString(),
      `comments:${item.comments}`,
    ]);
  });

  const nowTime = new Date(); // local time
  // calculate utc+0 time diff
  const utcTimeOffset = nowTime.getTimezoneOffset() / 60;
  //calculate taipei time
  const taipeiTime = nowTime.setHours(nowTime.getHours() + (utcTimeOffset + 8));
  // use moment to format time
  const showedTime = moment(taipeiTime).format('YYYY-MM-DD HH:mm:ss');

  result = table(
    [
      [`Medium @${MEDIUM_USER_NAME}`],
      [`cronJob updateAt :${showedTime} GMT+8`],
      ['Latest Stories:'],
      ...result,
    ],
    {
      align: ['l', 'r'],
      stringLength: () => 20,
    }
  );

  const box = new GistBox({ id: GIST_ID, token: GH_PAT });

  try {
    await box.update({
      filename: 'medium-stat.md',
      content: result,
    });
  } catch (err) {
    throw new Error('push to gist failed');
  }
}

getMediumStats();
