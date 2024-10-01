import { Hono } from 'hono';
import { cors } from 'hono/cors'
import { createSetlist, spGetPlaylist, spModSearchSong, spReCreatePlaylist } from './spotify'


const app = new Hono();

// CORSミドルウェアを追加
app.use('*', cors())

interface Song {
  name: string;
  original_artist: string;
  is_tape?: boolean;
  is_cover: boolean;
  position?: number;
}

interface Setlist {
  artist_name: string;
  event_date: Date;
  location: string;
  venue: string;
  tour_name: string;
  songs: Song[];
  setlist_id?: string;
}

app.get('/', (c) => {
	return c.text('Hello Hono!');
});

app.get('/api/setlistfm/:id', async (c) => {  // Setlist.fmからセットリストを取得
  const id = c.req.param('id')
  // const iscover = c.req.query('isCover')
  // const istape = c.req.query('isTape')

  const iscover: boolean = c.req.query('isCover') === 'true'  // 上のやり方だとstringが代入されるので上手くいかなかった(型を付けることの大切さ)
  const istape: boolean = c.req.query('isTape') === 'true'


  const url: string = `https://api.setlist.fm/rest/1.0/setlist/${id}`
  const headers = {
      "x-api-key": "rvH9s-nOQE4FOGgLByWj1VfmjzqIaEt5Q8wB",
      "Accept": "application/json",
      "Access-Control-Allow-Origin": "*"
  }

  try {
      const response = await fetch(url, { headers })

      if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: any = await response.json();

      const artistName = data.artist.name;
      const eventDate = new Date(data.eventDate.split('-').reverse().join('-'));
      const venueData = data.venue;
      const cityData = venueData.city;
      const country = cityData.country.name;
      const city = `${cityData.name}, ${country}`;
      const venue = venueData.name;
      const tourName = data.tour?.name || "";

      const setlistSongs: Song[] = [];

      data.sets.set.forEach((setData: any) => {
          setData.song.forEach((songData: any) => {

              const songName = songData.name;
              const isTape = songData.tape || false;
              const isCover = 'cover' in songData;
              const medleyParts = songName.split(" / ");

              for (const medleyPart of medleyParts) {
                  const originalArtist = isCover ? songData.cover.name : artistName;
                  const song: Song = {
                      name: medleyPart,
                      original_artist: originalArtist,
                      is_tape: isTape,
                      is_cover: isCover,
                  };


                  if (song.is_tape) {
                      continue;
                  }

                  if (!iscover || !song.is_cover) {
                      setlistSongs.push(song);
                  }

              };
          });
      });



      const setlist: Setlist = {
          artist_name: artistName,
          event_date: eventDate,
          location: city,
          venue: venue,
          tour_name: tourName,
          songs: setlistSongs,
      };

      const setlist_id = await createSetlist(setlist);

      setlist['setlist_id'] = setlist_id;

      return c.json(setlist);

  } catch (error) {
      console.error('Error fetching setlist:', error)
      return c.json({ error: 'Failed to fetch setlist' }, 500)
  }
})

app.get('/api/modify/:id', async (c) => {
  const id = c.req.param('id')

  const response: any = await spGetPlaylist(id);
  return c.json(response);
});

// 曲名とアーティスト名からSpotifyを検索
app.get('/api/song/search/:artist/:name', async (c) => {
  const name: string = c.req.param('name') || ''
  const artist: string = c.req.param('artist') || ''

  const data = await spModSearchSong(name, artist);

  return c.json(data);
})

app.post('/api/recreate/playlist/:id', async (c) => {
  const id: string = c.req.param('id')
  const songIds: string[] = JSON.parse(await c.req.text());
  console.log(songIds);

  const playlistId = await spReCreatePlaylist(id, songIds) as any;

  return c.json(playlistId);
})

export default app;
