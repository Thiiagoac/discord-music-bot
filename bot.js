
const Discord = require('discord.js')
const client = new Discord.Client()
const config = require("./config.json")
const queue = new Map();
const {
	prefix,
	token,
	API_KEY
} = require('./config.json');
const ytdl = require('ytdl-core');
const { google } = require('googleapis');
var idMusicas = []
var titleSongs = []
var option;
var select = 0;

// Initialize the API client library
client.on('ready', () => {
	console.log(`Logado como ${client.user.username}!`)
})
//BASICOS
client.once('ready', () => {
	console.log('Ready!');
});
client.once('reconnecting', () => {
	console.log('Reconnecting!');
});
client.once('disconnect', () => {
	console.log('Disconnect!');
});
//END BASICOS

client.on('message', async message => {

	if (message.author.bot) return;
	if (!message.content.startsWith(prefix)) return;

	const serverQueue = queue.get(message.guild.id);

	if (message.content.startsWith(`${prefix}play`) ||
		message.content.startsWith(`${prefix}p`) &&
		(!message.content.startsWith(`${prefix}p http://www.youtube.com`))) {
		idMusicas = []
		titleSongs = []
		search(message, serverQueue)
		return;
	} else if (message.content.startsWith(`${prefix}skip`)) {
		skip(message, serverQueue);
		return;
	} else if (message.content.startsWith(`${prefix}p http://www.youtube.com`)) {
		execute(message, serverQueue);
		return;
	} else if (message.content.startsWith(`${prefix}stop`)) {
		stop(message, serverQueue);
		return;
	} else {
		message.channel.send('You need to enter a valid command!')
	}
});

async function search(message, serverQueue) {
	var res = null;
	if (select == 0) {
		const youtube = google.youtube({
			version: 'v3',
			auth: API_KEY
		});
		res = await youtube.search.list({
			part: 'snippet',
			q: message.content,
			maxResults: 10,
		});

		console.log("=============")
		for (var i = 0; i < 10; i++) {
			console.log(`[${i + 1}] - ${res.data.items[i].snippet.title}`);
			idMusicas.push(res.data.items[i].id.videoId);
			titleSongs.push(res.data.items[i].snippet.title);
			console.log(idMusicas[i]);
		}
		console.log("- - - - -")

		const m = await message.channel.send("..");
		const args = message.content.split('=p');
		var nomeMusicas = `\n Músicas de :${args[1]} 
					   \n [1] - ${res.data.items[0].snippet.title}`
		for (var i = 1; i < 10; i++) {
			nomeMusicas = nomeMusicas + (`\n [${i + 1}] - ${res.data.items[i].snippet.title}`);
		}
		m.edit(`${nomeMusicas}`);
	}

	if (select == 0) {
		message.channel.send('\n Digite o número da musica')
			.then(() => {
				message.channel.awaitMessages(message => message.content, {
					max: 1,
					time: 300000,
					errors: ['time'],
				})
					.then((collected) => {
						message.channel.send(`Esolheu musica: ${collected.first().content}`);
						console.log(`==${collected.first().content}`)
						option = collected.first().content - 1
						select = 1;
						search(message, serverQueue)
					})
					.catch(() => {
						return;
					});
			});
	} else if (select == 1) {
		select = 0;
		console.log(`opção = ${option}`);

		const voiceChannel = message.member.voiceChannel;
		if (!voiceChannel) return message.channel.send('You need to be in a voice channel to play music!');
		const permissions = voiceChannel.permissionsFor(message.client.user);
		if (!permissions.has('CONNECT') || !permissions.has('SPEAK')) {
			return message.channel.send('I need the permissions to join and speak in your voice channel!');
		};

		const songInfo = await ytdl.getInfo(`https://www.youtube.com/watch?v=${idMusicas[option]}`);
		const song = {
			title: titleSongs[option],
			url: songInfo.video_url,
		};

		option = null;
		select = 0;
		idMusicas = []
		titleSongs = []

		if (!serverQueue) {
			const queueContruct = {
				textChannel: message.channel,
				voiceChannel: voiceChannel,
				connection: null,
				songs: [],
				volume: 3,
				playing: true,
			};

			queue.set(message.guild.id, queueContruct);

			queueContruct.songs.push(song);

			try {
				var connection = await voiceChannel.join();
				queueContruct.connection = connection;
				play(message.guild, queueContruct.songs[0]);
			} catch (err) {
				console.log(err);
				queue.delete(message.guild.id);
				return message.channel.send(err);
			}
		} else {
			serverQueue.songs.push(song);
			console.log(serverQueue.songs);
			return message.channel.send(`${song.title} has been added to the queue!`);

		}
	}
	console.log(idMusicas)
};

//QUEUE
async function execute(message, serverQueue) {
	const args = message.content.split(' ');

	const voiceChannel = message.member.voiceChannel;
	if (!voiceChannel) return message.channel.send('You need to be in a voice channel to play music!');
	const permissions = voiceChannel.permissionsFor(message.client.user);
	if (!permissions.has('CONNECT') || !permissions.has('SPEAK')) {
		return message.channel.send('I need the permissions to join and speak in your voice channel!');
	}

	const songInfo = await ytdl.getInfo(args[1]);
	const song = {
		title: songInfo.title,
		url: songInfo.video_url,
	};

	if (!serverQueue) {
		const queueContruct = {
			textChannel: message.channel,
			voiceChannel: voiceChannel,
			connection: null,
			songs: [],
			volume: 3,
			playing: true,
		};

		queue.set(message.guild.id, queueContruct);

		queueContruct.songs.push(song);

		try {
			var connection = await voiceChannel.join();
			queueContruct.connection = connection;
			play(message.guild, queueContruct.songs[0]);
		} catch (err) {
			console.log(err);
			queue.delete(message.guild.id);
			return message.channel.send(err);
		}
	} else {
		serverQueue.songs.push(song);
		console.log(serverQueue.songs);
		return message.channel.send(`${song.title} has been added to the queue!`);
	}

}

function skip(message, serverQueue) {
	if (!message.member.voiceChannel) return message.channel.send('You have to be in a voice channel to stop the music!');
	if (!serverQueue) return message.channel.send('There is no song that I could skip!');
	serverQueue.connection.dispatcher.end();
}

function stop(message, serverQueue) {
	if (!message.member.voiceChannel) return message.channel.send('You have to be in a voice channel to stop the music!');
	serverQueue.songs = [];
	serverQueue.connection.dispatcher.end();
}

function play(guild, song) {
	const serverQueue = queue.get(guild.id);

	if (!song) {
		serverQueue.voiceChannel.leave();
		queue.delete(guild.id);
		return;
	}

	const dispatcher = serverQueue.connection.playStream(ytdl(song.url))
		.on('end', () => {
			console.log('Music ended!');
			serverQueue.songs.shift();
			play(guild, serverQueue.songs[0]);
		})
		.on('error', error => {
			console.error(error);
		});
	dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
}


client.login(token)

