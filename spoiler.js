const https = require('https')
const request = require('request')
const cheerio = require('cheerio')
const express = require('express')
const fs = require('fs')
const readLineSync = require('readline-sync')

const app = express()
const port = 8080

app.get('/movies', (req, res) => { // used to fetch JSON of searched movies through the terminal
  fs.readFileSync('spoiled-movies.txt', function(err, data) {
    let sliced = data.toString().substring(0, data.toString().length-2)
    let newData = `{ "MoviesList" : [ ${sliced} ] }`;
    res.send(JSON.parse(newData));
    })
  })
  
app.listen(port, () => {
    console.log(`Listening on Port ${port}`)
  })
    
let haveTitle = false
let haveNumber = false
let title = ''
let warningTime = ''
let movie = new Movie()
let exitMessage = ''
// const keywords = ['IMDb', '(film) - Wikipedia']
const keywords = ['IMDb']
fs.readFile('darth-vader.txt', 'UTF-8', function(err, data) {
  if (err) { console.log(err) }
  else { 
    exitMessage = data
  }
})


const args = process.argv.splice(2)

args.forEach( (value, index) => {
  let item = Number(value)
  if(isNaN(item)) {
    title = value
    haveTitle = true
  } else if ( item > 0 ) {
    warningTime = Number(value)
    haveNumber = true
  }
})

function Movie(name, release, tmdbID, imdbID, tmdbPlot, imdbPlot, tmdbUrl, imdbUrl, poster) {
  this.name = name
  this.release = release
  this.tmdbID = tmdbID
  this.imdbID = imdbID
  this.tmdbPlot = tmdbPlot
  this.imdbPlot = imdbPlot
  this.imdbUrl = imdbUrl
  this.tmdbUrl = tmdbUrl
  this.poster = poster
}

var getCorrectAnswer = (message) => {
  let response = readLineSync.question(message)
  switch (response) {
    case 'y':
      haveTitle = false
      haveNumber = false
      spoilerMachine() //continuous loop
      break
    case 'n':
      console.log(exitMessage)
      break
    default:
      console.log('Incorrect input. Try Again.')
      getCorrectAnswer(message)
      break
  }
}

var spoilerMachine = () => {
  while (!haveTitle) {
    title = readLineSync.question('Please enter a movie title: ')
    if(isNaN(Number(title))) {
      haveTitle = true
    }
  }
  while (!haveNumber) {
    warningTime = readLineSync.question('Please enter a warning time in seconds: ')
    if(!isNaN(Number(warningTime)) && Number(warningTime) > 0) {
      // console.log(warningTime)
      haveNumber = true
    }
  }
  
  if (haveTitle && haveNumber) {
    // console.log('A movie(string) and a number(integer) is found...') //doesnt work if the movie is just a number...
    console.log(`\nMovie title is ${title}.`)
    console.log(`Wait time is ${warningTime} seconds.`)
    movie.name = title;
    
    request(`https://www.google.com/search?q=${title}`, function(error, response, body) {
      // Print the error if one occurred
      // console.log('error:', error)
      // Print the response status code if a response was received
      // console.log('statusCode:', response && response.statusCode)
      // console.log(body)
      fs.writeFile("googlebody.html", body, function(err) {
        //checking if divs & classes exist when html of the body is returned
        //if (err) { console.log(err) } else { console.log("Write OK.") }
      })
      var $ = cheerio.load(body)
    
      let resultsArray = []
      let urls = []
      $('div.g').each(function(index, value) {
        let title = $(this).find('h3.r').text()
        let url = $(this).find('cite').text()
  
        keywords.forEach(function(value, index) {
          if(title.includes(value)) {
            // console.log(`The heading [${title}] includes the keyword ${value}.`)
            urls.push(url)
            request(`http://${url}`, function(error, response, body) {
              fs.writeFile("imdb.html", body, function(err) {
                //checking if divs & classes exist when html is returned in a saved file
                // if (err) { console.log(err) } else { console.log("Write OK.") }
              })
              const $$ = cheerio.load(body)
              // console.log(error);
              movie.imdbID = url //Need to use Regex to get correct ID...
              movie.imdbPlot = $$('div.summary_text').text().trim();
              if (movie.imdbPlot == undefined) {
                movie.imdbPlot = 'No Data Found.'
              }
              // console.log(`\nIMDb Plot:\n${movie.imdbPlot}`)
            })
          }
        })
        if(title != '') {
          resultsArray.push(title)
        }
      })
    
      console.log(`\nGoogle Results for -> ${title} <-`)
      resultsArray.forEach( (value, index) => {
        console.log(`[${index + 1}]: ${value}`)
      })
  
      var options = {
        method: 'GET',
        url: 'https://api.themoviedb.org/3/search/movie',
        qs: {
          include_adult: 'false',
          page: '1',
          language: 'en-US',
          api_key: '7a9602f5224d26b4db42b9c580059391',
          query: title
        }
      }
      request(options, function(error, response, body) { //TMDb API Search Request
        if (error) console.log(error)
        let obj = JSON.parse(body)
        // console.log(obj)
        let totalResults = obj.total_results
        let results = obj.results
        // console.log(results)
        if(totalResults === 0) {
            console.log('\nNo movie was found in TMDb, please refine your search.\n')
        } else {
          results.some(function(value, index) {
            let titleInWords = title.split(' ')
            let count = 0
            titleInWords.forEach((val, index) => {
              if (value.title.toUpperCase().includes(val.toUpperCase())) {
                count++
              }
            })
            // console.log(count)
            if (count === titleInWords.length) {
              //console.log(`\nFound the movie!!! It\'s ${value.title}.`)
              movie.name = value.title
              let urlencodedMovie = movie.name.replace(/ /g, '+').toLowerCase()
              //console.log(`Encoded Title: ${urlencodedMovie}.`)
              movie.release = value.release_date;
              movie.poster = `${baseImageUrl}${value.poster_path}`
              movie.tmdbID = value.id
              movie.tmdbPlot = value.overview
              movie.tmdbUrl = `${tmdbUrlBase}${movie.tmdbID}-${urlencodedMovie}`
              movie.totalResults = value.total_results
              // console.log(value)
              console.log(`\n\n***spoiler warning*** We will be spoiling the plot of ${movie.name} in ${warningTime} seconds.\n`)
              setTimeout(function() { printSpoiler() }, warningTime*1000)
              let count = warningTime
  
              var counter = setInterval(countdown, 1000)
              function countdown() {
                count--
                console.log(`${count}...`)
                if(count === 1) {
                  clearInterval(counter)
                }
              }
              return true;
            }
          })
        }
      })
    })
    const baseImageUrl = 'http://image.tmdb.org/t/p/original'
    const tmdbUrlBase = 'https://www.themoviedb.org/movie/';
    
    var printSpoiler = () => {
      console.log(`\nTMDb Plot:\n${movie.tmdbPlot}`)
      console.log(`\nIMDb Plot:\n${movie.imdbPlot}`)
      fs.appendFileSync('spoiled-movies.txt', `{ "name": "${movie.name}", "release": "${movie.release}" },\n`, function(err) {
        if (err) throw err
        //console.log('Saved!');
      });
      getCorrectAnswer('\nWould you like to see another spoiler? (Enter y / n)\n')
    }
  }
}

spoilerMachine() //runs the first instance