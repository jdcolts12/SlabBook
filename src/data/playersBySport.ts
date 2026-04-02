/** Curated top names per sport for autocomplete (local lists). */
const NFL: string[] = [
  'Patrick Mahomes', 'Josh Allen', 'Lamar Jackson', 'Joe Burrow', 'Jalen Hurts',
  'Dak Prescott', 'Justin Herbert', 'Tua Tagovailoa', 'Aaron Rodgers', 'Matthew Stafford',
  'Brock Purdy', 'C.J. Stroud', 'Trevor Lawrence', 'Justin Fields', 'Jordan Love',
  'Kirk Cousins', 'Jared Goff', 'Geno Smith', 'Russell Wilson', 'Derek Carr',
  'Christian McCaffrey', 'Saquon Barkley', 'Derrick Henry', 'Nick Chubb', 'Josh Jacobs',
  'Breece Hall', 'Jonathan Taylor', 'Alvin Kamara', 'Tony Pollard', 'Rachaad White',
  'Tyreek Hill', 'Justin Jefferson', 'Ja\'Marr Chase', 'CeeDee Lamb', 'Stefon Diggs',
  'Davante Adams', 'A.J. Brown', 'Mike Evans', 'Chris Godwin', 'DK Metcalf',
  'Cooper Kupp', 'Amon-Ra St. Brown', 'Garrett Wilson', 'Jaylen Waddle', 'DeVonta Smith',
  'Travis Kelce', 'Mark Andrews', 'George Kittle', 'Sam LaPorta', 'T.J. Hockenson',
  'Micah Parsons', 'Nick Bosa', 'Myles Garrett', 'T.J. Watt', 'Maxx Crosby',
  'Aaron Donald', 'Chris Jones', 'Dexter Lawrence', 'Quinnen Williams', 'Aidan Hutchinson',
  'Jalen Ramsey', 'Sauce Gardner', 'Patrick Surtain II', 'Darius Slay', 'Xavier McKinney',
  'Minkah Fitzpatrick', 'Derwin James', 'Jessie Bates', 'Harrison Smith', 'Antoine Winfield Jr.',
  'Justin Tucker', 'Harrison Butker', 'Evan McPherson', 'Jake Elliott', 'Brandon Aubrey',
  'Tom Brady', 'Peyton Manning', 'Joe Montana', 'Jerry Rice', 'Barry Sanders',
  'Walter Payton', 'Lawrence Taylor', 'Reggie White', 'Deion Sanders', 'Randy Moss',
  'Calvin Johnson', 'Rob Gronkowski', 'Tony Gonzalez', 'Ray Lewis', 'Ed Reed',
  'Troy Polamalu', 'Brian Urlacher', 'Julius Peppers', 'Jason Taylor', 'Michael Strahan',
  'Emmitt Smith', 'Terrell Owens', 'Michael Irvin', 'Troy Aikman', 'Roger Staubach',
]

const NBA: string[] = [
  'LeBron James', 'Stephen Curry', 'Kevin Durant', 'Giannis Antetokounmpo', 'Nikola Jokić',
  'Joel Embiid', 'Luka Dončić', 'Jayson Tatum', 'Devin Booker', 'Damian Lillard',
  'Anthony Edwards', 'Shai Gilgeous-Alexander', 'Ja Morant', 'Trae Young', 'Donovan Mitchell',
  'Kawhi Leonard', 'Paul George', 'Jimmy Butler', 'Bam Adebayo', 'Tyrese Haliburton',
  'Jaylen Brown', 'Jalen Brunson', 'Anthony Davis', 'Kyrie Irving', 'James Harden',
  'Russell Westbrook', 'Chris Paul', 'Klay Thompson', 'Draymond Green', 'De\'Aaron Fox',
  'Domantas Sabonis', 'Julius Randle', 'Scottie Barnes', 'Paolo Banchero', 'Chet Holmgren',
  'Victor Wembanyama', 'Zion Williamson', 'Brandon Ingram', 'DeMar DeRozan', 'Zach LaVine',
  'LaMelo Ball', 'Mikal Bridges', 'Miles Bridges', 'Jalen Green', 'Alperen Sengun',
  'Cade Cunningham', 'Jaden Ivey', 'Franz Wagner', 'Evan Mobley', 'Darius Garland',
  'Desmond Bane', 'Jaren Jackson Jr.', 'Karl-Anthony Towns', 'Rudy Gobert', 'Anthony Edwards',
  'Kevin Garnett', 'Dirk Nowitzki', 'Tim Duncan', 'Kobe Bryant', 'Shaquille O\'Neal',
  'Michael Jordan', 'Magic Johnson', 'Larry Bird', 'Hakeem Olajuwon', 'David Robinson',
  'Allen Iverson', 'Tracy McGrady', 'Vince Carter', 'Ray Allen', 'Paul Pierce',
  'Dwyane Wade', 'Chris Bosh', 'Carmelo Anthony', 'Dwight Howard', 'Steve Nash',
  'Jason Kidd', 'Gary Payton', 'Scottie Pippen', 'Dennis Rodman', 'Patrick Ewing',
  'Charles Barkley', 'Karl Malone', 'John Stockton', 'Isiah Thomas', 'Oscar Robertson',
  'Bill Russell', 'Wilt Chamberlain', 'Jerry West', 'Elgin Baylor', 'Bob Cousy',
  'Rick Barry', 'Julius Erving', 'George Gervin', 'Dominique Wilkins', 'Clyde Drexler',
]

const MLB: string[] = [
  'Shohei Ohtani', 'Aaron Judge', 'Ronald Acuña Jr.', 'Mookie Betts', 'Freddie Freeman',
  'Juan Soto', 'Vladimir Guerrero Jr.', 'Yordan Alvarez', 'Kyle Tucker', 'José Ramírez',
  'Corey Seager', 'Bobby Witt Jr.', 'Gunnar Henderson', 'Julio Rodríguez', 'Corbin Carroll',
  'Elly De La Cruz', 'Francisco Lindor', 'Trea Turner', 'Bo Bichette', 'Xander Bogaerts',
  'Matt Olson', 'Pete Alonso', 'Paul Goldschmidt', 'Nolan Arenado', 'Austin Riley',
  'Rafael Devers', 'Alex Bregman', 'Jose Altuve', 'Yandy Díaz', 'Randy Arozarena',
  'Bryce Harper', 'Kyle Schwarber', 'Nick Castellanos', 'Ketel Marte', 'Christian Yelich',
  'William Contreras', 'Adley Rutschman', 'Salvador Perez', 'J.T. Realmuto', 'Will Smith',
  'Spencer Strider', 'Gerrit Cole', 'Jacob deGrom', 'Max Scherzer', 'Justin Verlander',
  'Corbin Burnes', 'Zack Wheeler', 'Blake Snell', 'Tyler Glasnow', 'Shane McClanahan',
  'Dylan Cease', 'Logan Webb', 'George Kirby', 'Luis Castillo', 'Framber Valdez',
  'Yoshinobu Yamamoto', 'Kodai Senga', 'Tarik Skubal', 'Hunter Greene', 'Grayson Rodriguez',
  'Mike Trout', 'Clayton Kershaw', 'Miguel Cabrera', 'Albert Pujols', 'Ichiro Suzuki',
  'Derek Jeter', 'Alex Rodriguez', 'Barry Bonds', 'Ken Griffey Jr.', 'Randy Johnson',
  'Greg Maddux', 'Tom Glavine', 'John Smoltz', 'Pedro Martínez', 'Roger Clemens',
  'Nolan Ryan', 'Sandy Koufax', 'Bob Gibson', 'Hank Aaron', 'Willie Mays',
  'Mickey Mantle', 'Babe Ruth', 'Lou Gehrig', 'Ted Williams', 'Jackie Robinson',
  'Roberto Clemente', 'Stan Musial', 'Ty Cobb', 'Cy Young', 'Cal Ripken Jr.',
  'Tony Gwynn', 'Rickey Henderson', 'Reggie Jackson', 'George Brett', 'Rod Carew',
  'Johnny Bench', 'Yogi Berra', 'Joe DiMaggio', 'Sandy Koufax', 'Bob Feller',
]

const NHL: string[] = [
  'Connor McDavid', 'Leon Draisaitl', 'Nathan MacKinnon', 'Cale Makar', 'Auston Matthews',
  'Mitch Marner', 'William Nylander', 'David Pastrnak', 'Brad Marchand', 'Charlie McAvoy',
  'Nikita Kucherov', 'Steven Stamkos', 'Andrei Vasilevskiy', 'Artemi Panarin', 'Igor Shesterkin',
  'Jack Hughes', 'Nico Hischier', 'Jason Robertson', 'Roope Hintz', 'Miro Heiskanen',
  'Kirill Kaprizov', 'Matthew Boldy', 'Sidney Crosby', 'Evgeni Malkin', 'Jake Guentzel',
  'Alex Ovechkin', 'Dylan Strome', 'John Carlson', 'Quinn Hughes', 'Elias Pettersson',
  'J.T. Miller', 'Bo Horvat', 'Tim Stützle', 'Brady Tkachuk', 'Claude Giroux',
  'Aleksander Barkov', 'Matthew Tkachuk', 'Sam Reinhart', 'Sergei Bobrovsky', 'Roman Josi',
  'Filip Forsberg', 'Juuse Saros', 'Jason Robertson', 'Roope Hintz', 'Joe Pavelski',
  'Mark Stone', 'Jack Eichel', 'William Karlsson', 'Jonathan Marchessault', 'Adin Hill',
  'Tage Thompson', 'Rasmus Dahlin', 'Alex Tuch', 'Kyle Connor', 'Mark Scheifele',
  'Connor Hellebuyck', 'Elias Lindholm', 'Mikko Rantanen', 'Nathan MacKinnon', 'Gabriel Landeskog',
  'Patrick Kane', 'Jonathan Toews', 'Alex DeBrincat', 'Kirby Dach', 'Seth Jones',
  'Carey Price', 'Shea Weber', 'P.K. Subban', 'Steven Stamkos', 'Victor Hedman',
  'Wayne Gretzky', 'Mario Lemieux', 'Sidney Crosby', 'Alex Ovechkin', 'Jaromír Jágr',
  'Patrick Roy', 'Martin Brodeur', 'Dominik Hašek', 'Nicklas Lidström', 'Chris Pronger',
  'Joe Sakic', 'Peter Forsberg', 'Steve Yzerman', 'Brendan Shanahan', 'Sergei Fedorov',
  'Pavel Bure', 'Teemu Selänne', 'Paul Kariya', 'Eric Lindros', 'Jarome Iginla',
  'Joe Thornton', 'Henrik Lundqvist', 'Henrik Zetterberg', 'Pavel Datsyuk', 'Nicklas Lidström',
  'Jonathan Quick', 'Drew Doughty', 'Anže Kopitar', 'Jeff Carter', 'Dustin Brown',
  'Brad Marchand', 'Patrice Bergeron', 'David Krejčí', 'Tuukka Rask', 'Zdeno Chára',
]

const Soccer: string[] = [
  'Lionel Messi', 'Cristiano Ronaldo', 'Kylian Mbappé', 'Erling Haaland', 'Kevin De Bruyne',
  'Mohamed Salah', 'Harry Kane', 'Vinícius Júnior', 'Jude Bellingham', 'Luka Modrić',
  'Robert Lewandowski', 'Karim Benzema', 'Neymar', 'Pedri', 'Gavi',
  'Phil Foden', 'Bukayo Saka', 'Martin Ødegaard', 'Son Heung-min', 'Victor Osimhen',
]

const MMA: string[] = [
  'Jon Jones', 'Islam Makhachev', 'Alexander Volkanovski', 'Leon Edwards', 'Alex Pereira',
  'Sean Strickland', 'Dricus du Plessis', 'Ilia Topuria', 'Max Holloway', 'Charles Oliveira',
  'Conor McGregor', 'Khabib Nurmagomedov', 'Georges St-Pierre', 'Anderson Silva', 'Fedor Emelianenko',
]

export const PLAYERS_BY_SPORT: Record<string, string[]> = {
  NFL,
  NBA,
  MLB,
  NHL,
  Soccer,
  MMA,
}

export function getPlayersForSport (sport: string): string[] {
  const list = PLAYERS_BY_SPORT[sport] ?? []
  return [...new Set(list)]
}
