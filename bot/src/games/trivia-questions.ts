// The /trivia question bank. The first answer is the correct one; answers are shuffled
// before they're shown. Stick to facts that don't change, so no answer goes stale.

export const categories = [
	{ key: 'science', label: 'Science' },
	{ key: 'geography', label: 'Geography' },
	{ key: 'history', label: 'History' },
	{ key: 'technology', label: 'Technology' },
	{ key: 'sports', label: 'Sports' },
	{ key: 'nature', label: 'Nature' },
	{ key: 'arts', label: 'Arts' },
	{ key: 'general', label: 'General' }
] as const;

export type Category = (typeof categories)[number]['key'];

export type Question = {
	category: Category;
	question: string;
	answers: [correct: string, ...wrong: string[]];
};

export const questions: Question[] = [
	// Science
	{
		category: 'science',
		question: 'Which gas do plants take in from the air for photosynthesis?',
		answers: ['Carbon dioxide', 'Oxygen', 'Nitrogen', 'Hydrogen']
	},
	{
		category: 'science',
		question: 'What is the chemical symbol for gold?',
		answers: ['Au', 'Ag', 'Gd', 'Go']
	},
	{
		category: 'science',
		question: 'How many bones are in the adult human body?',
		answers: ['206', '186', '226', '256']
	},
	{
		category: 'science',
		question: 'Which planet is known as the Red Planet?',
		answers: ['Mars', 'Jupiter', 'Venus', 'Mercury']
	},
	{
		category: 'science',
		question: 'What is the hardest naturally occurring material?',
		answers: ['Diamond', 'Quartz', 'Granite', 'Iron']
	},
	{
		category: 'science',
		question: 'What is the largest planet in our solar system?',
		answers: ['Jupiter', 'Saturn', 'Neptune', 'Uranus']
	},
	{
		category: 'science',
		question: 'At sea level, at what temperature does water boil?',
		answers: ['100 °C', '90 °C', '110 °C', '120 °C']
	},
	{
		category: 'science',
		question: 'Which element has the atomic number 1?',
		answers: ['Hydrogen', 'Helium', 'Oxygen', 'Carbon']
	},
	{
		category: 'science',
		question: 'Roughly how fast does light travel in a vacuum?',
		answers: [
			'300,000 km per second',
			'30,000 km per second',
			'3,000 km per second',
			'3,000,000 km per second'
		]
	},
	{
		category: 'science',
		question: 'Which organ pumps blood around the body?',
		answers: ['The heart', 'The lungs', 'The liver', 'The kidneys']
	},

	// Geography
	{
		category: 'geography',
		question: 'What is the capital of Australia?',
		answers: ['Canberra', 'Sydney', 'Melbourne', 'Perth']
	},
	{
		category: 'geography',
		question: 'What is the largest ocean on Earth?',
		answers: ['The Pacific', 'The Atlantic', 'The Indian', 'The Arctic']
	},
	{
		category: 'geography',
		question: 'Mount Everest sits on the border between Nepal and which country?',
		answers: ['China', 'India', 'Bhutan', 'Pakistan']
	},
	{
		category: 'geography',
		question: 'What is the capital of Canada?',
		answers: ['Ottawa', 'Toronto', 'Vancouver', 'Montreal']
	},
	{
		category: 'geography',
		question: 'What is the largest hot desert in the world?',
		answers: ['The Sahara', 'The Gobi', 'The Kalahari', 'The Atacama']
	},
	{
		category: 'geography',
		question: 'Which river flows through Paris?',
		answers: ['The Seine', 'The Loire', 'The Rhône', 'The Danube']
	},
	{
		category: 'geography',
		question: 'What is the smallest country in the world by area?',
		answers: ['Vatican City', 'Monaco', 'San Marino', 'Liechtenstein']
	},
	{
		category: 'geography',
		question: 'Which US state is the largest by area?',
		answers: ['Alaska', 'Texas', 'California', 'Montana']
	},
	{
		category: 'geography',
		question: 'In which country is the city of Marrakesh?',
		answers: ['Morocco', 'Tunisia', 'Egypt', 'Algeria']
	},
	{
		category: 'geography',
		question: 'What is the capital of Japan?',
		answers: ['Tokyo', 'Kyoto', 'Osaka', 'Hiroshima']
	},

	// History
	{
		category: 'history',
		question: 'In which year did World War II end?',
		answers: ['1945', '1944', '1946', '1939']
	},
	{
		category: 'history',
		question: 'Who was the first person to walk on the Moon?',
		answers: ['Neil Armstrong', 'Buzz Aldrin', 'Yuri Gagarin', 'John Glenn']
	},
	{
		category: 'history',
		question: 'Which civilization built Machu Picchu?',
		answers: ['The Inca', 'The Maya', 'The Aztecs', 'The Olmecs']
	},
	{
		category: 'history',
		question: 'In which year did the Berlin Wall fall?',
		answers: ['1989', '1991', '1987', '1979']
	},
	{
		category: 'history',
		question: 'Who was the first President of the United States?',
		answers: ['George Washington', 'Thomas Jefferson', 'John Adams', 'Abraham Lincoln']
	},
	{
		category: 'history',
		question: 'Which ship sank on its maiden voyage in 1912?',
		answers: ['The Titanic', 'The Lusitania', 'The Britannic', 'The Olympic']
	},
	{
		category: 'history',
		question: 'The Rosetta Stone helped scholars read which writing system?',
		answers: ['Egyptian hieroglyphs', 'Cuneiform', 'Linear B', 'Maya glyphs']
	},
	{
		category: 'history',
		question: 'Who was the first emperor of Rome?',
		answers: ['Augustus', 'Julius Caesar', 'Nero', 'Caligula']
	},
	{
		category: 'history',
		question: 'In which country did the Industrial Revolution begin?',
		answers: ['Great Britain', 'France', 'Germany', 'The United States']
	},

	// Technology
	{
		category: 'technology',
		question: 'What does "CPU" stand for?',
		answers: [
			'Central Processing Unit',
			'Computer Personal Unit',
			'Central Program Utility',
			'Core Processing Unit'
		]
	},
	{
		category: 'technology',
		question: 'What does "HTTP" stand for?',
		answers: [
			'Hypertext Transfer Protocol',
			'High Transfer Text Protocol',
			'Hyperlink Text Transport Program',
			'Host Transfer Text Protocol'
		]
	},
	{
		category: 'technology',
		question: 'How many bits are in a byte?',
		answers: ['8', '4', '16', '10']
	},
	{
		category: 'technology',
		question: 'Which company makes the iPhone?',
		answers: ['Apple', 'Samsung', 'Google', 'Nokia']
	},
	{
		category: 'technology',
		question: 'What does "RAM" stand for?',
		answers: [
			'Random Access Memory',
			'Read Access Memory',
			'Rapid Action Memory',
			'Run Access Module'
		]
	},
	{
		category: 'technology',
		question: 'In binary, what is 1 + 1?',
		answers: ['10', '2', '11', '01']
	},
	{
		category: 'technology',
		question: 'Whose notes on the Analytical Engine are often called the first computer program?',
		answers: ['Ada Lovelace', 'Grace Hopper', 'Margaret Hamilton', 'Hedy Lamarr']
	},

	// Sports
	{
		category: 'sports',
		question: 'How many players does a soccer team have on the field at once?',
		answers: ['11', '10', '9', '12']
	},
	{
		category: 'sports',
		question: 'In which sport would you perform a slam dunk?',
		answers: ['Basketball', 'Volleyball', 'Tennis', 'Handball']
	},
	{
		category: 'sports',
		question: 'How many rings are on the Olympic flag?',
		answers: ['5', '4', '6', '7']
	},
	{
		category: 'sports',
		question: 'In tennis, what is a score of zero called?',
		answers: ['Love', 'Nil', 'Blank', 'Deuce']
	},
	{
		category: 'sports',
		question: 'How long is a marathon?',
		answers: ['About 42.2 km', 'About 40 km', 'About 50 km', 'About 32 km']
	},
	{
		category: 'sports',
		question: 'In chess, which piece moves only diagonally?',
		answers: ['The bishop', 'The rook', 'The knight', 'The king']
	},
	{
		category: 'sports',
		question: 'How many points is a touchdown worth in American football, before the extra point?',
		answers: ['6', '7', '3', '5']
	},

	// Nature
	{
		category: 'nature',
		question: 'What is the largest animal on Earth?',
		answers: ['The blue whale', 'The African elephant', 'The whale shark', 'The giraffe']
	},
	{
		category: 'nature',
		question: 'How many legs does a spider have?',
		answers: ['8', '6', '10', '12']
	},
	{
		category: 'nature',
		question: 'What do bees make from nectar?',
		answers: ['Honey', 'Wax', 'Pollen', 'Propolis']
	},
	{
		category: 'nature',
		question: 'Which flightless bird breeds during the Antarctic winter?',
		answers: ['The emperor penguin', 'The ostrich', 'The kiwi', 'The emu']
	},
	{
		category: 'nature',
		question: 'What is a baby kangaroo called?',
		answers: ['A joey', 'A kit', 'A cub', 'A calf']
	},
	{
		category: 'nature',
		question: 'Which is the fastest land animal?',
		answers: ['The cheetah', 'The pronghorn', 'The lion', 'The greyhound']
	},

	// Arts
	{
		category: 'arts',
		question: 'Who painted the Mona Lisa?',
		answers: ['Leonardo da Vinci', 'Michelangelo', 'Raphael', 'Botticelli']
	},
	{
		category: 'arts',
		question: 'Who wrote "Romeo and Juliet"?',
		answers: ['William Shakespeare', 'Christopher Marlowe', 'Charles Dickens', 'Jane Austen']
	},
	{
		category: 'arts',
		question: 'Who composed the "Moonlight Sonata"?',
		answers: [
			'Ludwig van Beethoven',
			'Wolfgang Amadeus Mozart',
			'Johann Sebastian Bach',
			'Frédéric Chopin'
		]
	},
	{
		category: 'arts',
		question:
			'In "The Lord of the Rings", who is the Ring-bearer who sets out to destroy the One Ring?',
		answers: ['Frodo Baggins', 'Samwise Gamgee', 'Bilbo Baggins', 'Aragorn']
	},
	{
		category: 'arts',
		question: 'How many keys does a standard modern piano have?',
		answers: ['88', '76', '92', '64']
	},
	{
		category: 'arts',
		question: 'Who painted "The Starry Night"?',
		answers: ['Vincent van Gogh', 'Claude Monet', 'Pablo Picasso', 'Salvador Dalí']
	},

	// General
	{
		category: 'general',
		question: 'How many days are in a leap year?',
		answers: ['366', '365', '364', '367']
	},
	{
		category: 'general',
		question: 'What is the main language spoken in Brazil?',
		answers: ['Portuguese', 'Spanish', 'French', 'Italian']
	},
	{
		category: 'general',
		question: 'How many sides does a hexagon have?',
		answers: ['6', '5', '7', '8']
	},
	{
		category: 'general',
		question: 'What colour do you get by mixing blue and yellow paint?',
		answers: ['Green', 'Purple', 'Orange', 'Brown']
	},
	{
		category: 'general',
		question: 'What is the square root of 144?',
		answers: ['12', '14', '11', '16']
	}
];
