import fetch from 'node-fetch';
import axios from 'axios';
import path from 'path';
import { getCredentials, setCredentials } from '../database/DatabaseQueries';
import { Post } from '../models/Post';
import { addWatermark } from '../utils/addWatermark';
import { uploadToImgur } from '../utils/uploadToImgur';

const FormData = require('form-data');

async function checkIgAuth(sessionid: string): Promise<any> {
  const res = axios.get(
    `${process.env.BASE_URL}/auth/settings/get?sessionid=${sessionid}`
  );
  return res.catch((err) => {
    if (err) return false;
    return true;
  });
}

/**
 * Returns if logged in or not
 */
export async function igLogin(): Promise<boolean> {
  const credentials = await getCredentials();
  const isAuth = await checkIgAuth(credentials.sessionid);
  if (!isAuth) {
    try {
      return await axios
        .post(
          `${process.env.BASE_URL}/auth/login`,
          new URLSearchParams({
            username: credentials.username,
            password: credentials.password,
          })
        )
        .then((res) => {
          if (res.data) {
            setCredentials(
              credentials.username,
              credentials.password,
              res.data,
              credentials.fbId,
              credentials.accessToken,
              credentials.clientSecret,
              credentials.clientId
            );
          }
          return true;
        });
    } catch (ex) {
      return false;
    }
  }
  console.log('Already logged in!');
  return true;
}

/**
 * Publish a post passed by param.
 * Returns permalink
 */
export async function publish(
  file: string,
  mediaType: string,
  caption: string,
  username: string
): Promise<string> {
  const { sessionid } = await getCredentials();
  if (mediaType === 'IMAGE') {
    const imagePath = path.join(__dirname, `../../storage/${file}`);

    const formData = new FormData();
    formData.append('sessionid', sessionid);
    const base64Content = await addWatermark(imagePath, username);

    const url = await uploadToImgur(base64Content, 'IMAGE');

    formData.append('caption', caption);
    formData.append('url', url);
    return fetch(`${process.env.BASE_URL}/photo/upload/by_url`, {
      method: 'POST',
      headers: formData.getHeaders(),
      body: formData,
    })
      .then((res) => res.json())
      .then((results) => {
        return `https://www.instagram.com/p/${results.code}`;
      })
      .catch((error) => {
        console.error(error);
      });
  }
  return '';
}

async function getHashtagId(hashtag: string) {
  const { accessToken, fbId } = await getCredentials();
  const hashtagIdRequest = axios.get(
    `https://graph.facebook.com/v12.0/ig_hashtag_search?q=${hashtag}&user_id=${fbId}&access_token=${accessToken}`
  );
  hashtagIdRequest.catch((err) => {
    if (err) console.log(err.data);
  });
  return (await hashtagIdRequest).data.data[0].id;
}

async function getUsername(post: { permalink: any }): Promise<string> {
  return new Promise((resolve) => {
    axios
      .get(`https://api.instagram.com/oembed/?url=${post.permalink}`)
      .then((data) => {
        if (data.status === 200) {
          return resolve(data.data.author_name);
        }
        return resolve('Unknown');
      });
    setTimeout(() => {
      resolve('Unknown');
    }, 5000);
  });
}

export async function getPosts(
  hashtag: string,
  type: string
): Promise<Post[] | undefined> {
  const { accessToken, fbId, username } = await getCredentials();
  const hashtagId = await getHashtagId(hashtag);
  if (hashtagId === undefined) return [];

  const dataJSON = axios.get(
    `https://graph.facebook.com/v12.0/${hashtagId}/${type}?user_id=${fbId}&access_token=${accessToken}&fields=id,children{media_url,media_type},caption,media_type,media_url,permalink`
  );

  return dataJSON.then((data) => {
    const postsJSON = data.data.data;
    if (data.data.error) {
      return;
    }
    const postsCount =
      postsJSON === undefined ? 0 : Object.keys(postsJSON).length;
    console.log(
      `Got ${postsCount} posts (unfiltered) from Instagram API #${hashtag}`
    );
    let actualPost: Post;
    return (async () => {
      const postsToReturn: any[] = [];
      for (let i = 0; i < postsCount; i++) {
        const post = postsJSON[i];
        let fusername = 'Unknown';
        try {
          fusername = await getUsername(post);
        } catch (err) {
          console.log("Couldn't get the username! ");
        }
        if (fusername !== username) {
          if (post.media_type === 'CAROUSEL_ALBUM') {
            // eslint-disable-next-line no-restricted-syntax
            for (const children of post.children.data) {
              actualPost = new Post(
                children.id,
                children.media_type,
                '',
                post.caption,
                post.permalink,
                hashtag,
                '',
                new Date().toLocaleDateString('en-GB'),
                fusername,
                post.id,
                children.media_url
              );
              postsToReturn.push(actualPost);
            }
          } else {
            actualPost = new Post(
              post.id,
              post.media_type,
              '',
              post.caption,
              post.permalink,
              hashtag,
              '',
              new Date().toLocaleDateString('en-GB'),
              fusername,
              '0',
              post.media_url
            );
            postsToReturn.push(actualPost);
          }
        }
      }
      return postsToReturn;
    })();
  });
}

export async function getRecentPosts(
  hashtag: string
): Promise<Post[] | undefined> {
  return getPosts(hashtag, 'recent_media');
}

export async function getTopPosts(
  hashtag: string
): Promise<Post[] | undefined> {
  return getPosts(hashtag, 'top_media');
}

export async function getUsernameFromId(id: string): Promise<string> {
  const { sessionid } = await getCredentials();
  return (
    await axios.post(
      `${process.env.BASE_URL}/user/info`,
      new URLSearchParams({
        sessionid,
        user_id: id,
      })
    )
  ).data.username;
}

module.exports = {
  igLogin,
  checkIgAuth,
  publish,
  getRecentPosts,
  getTopPosts,
  getUsernameFromId,
};
