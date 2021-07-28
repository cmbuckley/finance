function search(transaction) {
    // monzo
    if (transaction.category) {
        let category = (monzo.hasOwnProperty(transaction.category)
                     ? monzo[transaction.category]
                     : transaction.category);

        if (typeof category == 'function') {
            category = category(transaction);
        }

        return category;
    }

    // truelayer
    if (transaction.transaction_classification &&
        truelayer[transaction.transaction_classification[0]]
    ) {
        return truelayer[transaction.transaction_classification[0]][transaction.transaction_classification[1]];
    }
}

function lookup(key, matches, defaultResponse) {
    return function (transaction) {
        let isFunction   = (typeof defaultResponse === 'function'),
            defaultFunc  = (isFunction ? defaultResponse : function () {}),
            defaultValue = (isFunction ? null : defaultResponse);

        return Object.keys(matches).find(function (match) {
            let pattern = matches[match],
                value = transaction[key];

            return (pattern instanceof RegExp ? pattern.test(value) : value.includes(pattern));
        }) || defaultFunc(transaction) || defaultValue || '';
    };
}

function foursquareCategory(matches, defaultValue) {
    return function (transaction) {
        if (transaction.merchant && transaction.merchant.metadata) {
            if (matches[transaction.merchant.metadata.foursquare_category]) {
                return matches[transaction.merchant.metadata.foursquare_category];
            }
        }

        return (typeof defaultValue == 'function') ? defaultValue(transaction) : defaultValue;
    };
}

const monzo = {
    mondo:         '', // legacy
    general:       '', // TODO inspect
    expenses:      'Job Expenses', // TODO expand
    groceries:     'Food:Groceries',

    bills: lookup('description', {
        'Computing:Domains': /101DOMAIN|123[ -]?REG|NAMECHEAP|KEY-SYSTEMS|Gandi/,
        'Computing:Software': /ITUNES|1PASSWORD|PADDLE\.COM/,
        'Computing:VPS': /AWS|52B2222845CPN/,
        'Donations': /JUSTGIVING/i,
        'House:Improvement': /TIMPSON/,
        'House:Insurance': /SIMPLY BUSINESS/,
        'Leisure:Betting': /Betbull|SKYBET|SKY BETTING|PP ONLINE|VIRAL INTERACTIVE/,
        'Taxes': 'HMRC',
        'Utilities:Gas': 'BRITISH GAS',
    }, 'Bills'),
    personal_care: lookup('description', {
        'Healthcare:Dental': 'DENTAL',
        'Healthcare:Eyecare': 'CONTACT LENSES',
        'Personal Care:Hair': 'CITY IMAGE',
        'Pet Care:Vet': 'VETERINARY',
    }, 'Personal Care'),
    entertainment: lookup('description', {
        'Leisure:Activities': /ACTIVE NETWORK|TOUGH MUDDER/,
        'Leisure:Betting': /Betbull|SKYBET|SKY BETTING|PP ONLINE|VIRAL INTERACTIVE|PAYPAL \*BV/,
        'Leisure:Cinema': 'CINEMA',
        'Leisure:Climbing': 'CLIMBING',
        'Leisure:Music Events': /RECORDS|TICKETMASTER|SHEFFIELDSTUDENTSU/,
        'Leisure:Snowboarding': 'SNOZONE',
    }, 'Nights Out'),
    holidays: foursquareCategory({
        'Art Museum': 'Holiday:Activities',
        'Hotel': 'Holiday:Accommodation',
        'Post Office': 'Holiday',
    }, lookup('description', {
        'Car:Parking': 'MANCHESTER AIRPORT CAR',
        'Food:Eating Out': 'HMSHOST',
        'Holiday:Accommodation': /MOXY STRATFORD|HOTEL|Booking\.com/,
        'Holiday:Souvenirs': 'WDFG',
        'Holiday:Travel': /Trainline|WIZZ AIR|LOT INTERNET POLAND/,
        'Nights Out:Stag Do': 'GROUPIA',
    })),
    eating_out: foursquareCategory({
        'Fast Food Restaurant': 'Food:Takeaway',
        'Fried Chicken Joint':  'Food:Takeaway',
    }, lookup('description', {
        'Food': /CENTRE FILLING|UPTON GROUP|SESAME +LEEDS|MARKS&SPENCER/,
        'Food:Takeaway': /JUST[ -]EAT|DOMINO'S PIZZA|SUBWAY|DELIVEROO|GREGGS|UBER/i,
    }, 'Food:Eating Out')),
    shopping: foursquareCategory({
        'Board Shop': 'Shopping:Clothing',
        'Bookstore': 'Shopping:Books & Magazines',
        'Boutique': 'Shopping:Clothing',
        'Clothing Store': 'Shopping:Clothing',
        'Convenience Store': 'House', // not groceries
        'Cosmetics Shop': 'Gifts',
        'Department Store': 'Shopping:Clothing',
        'Electronics Store': 'House:Electronics',
        'Food & Drink Shop': 'Food',
        'Furniture / Home Store': 'House:Furniture',
        'Garden Center': 'House:Garden',
        'Gift Shop': 'Gifts',
        'Grocery Store': 'Food:Groceries',
        'Jewelry Store': 'Gifts',
        'Miscellaneous Shop': 'House',
        'Post Office': 'Shopping:Stationery',
        'Sporting Goods Shop': 'Shopping:Sporting Goods',
        'Supermarket': 'House', // not groceries
        'Warehouse Store': 'House',
        'Women\'s Store': 'Shopping:Clothing',
    }, lookup('description', {
        'Food:Alcohol': 'Veeno',
        'Gifts': /W\.KRUK|WARNER BROS STUDIOS|CAVENDISH JEWELLERS/,
        'House:Improvement': /BARGAIN TOOLS|SCREWFIX|B & Q/,
        'Leisure:Toys & Games': /LH TRADING|NINTENDO/,
        'Shopping:Clothing': /ASOS\.COM|MULBERRY|SELFRIDGES|HARRODS|JCHOOLIM|LPP|Polo Factory Store|HARVEY NICHOLS|INTIMISSIMI|J\.CHOO|VICTORIAS SECRET|PRIMARK|KLARNA|NEXT RETAIL|TEEPUBLIC/i,
        'Shopping:Music': /VINYL|HMV UK/i,
    })),
    cash: function (transaction) {
        if (transaction.counterparty.user_id) {
            return 'Loan';
        }
    },
    transport: foursquareCategory({
        'Automotive Shop': 'Car',
        'Gas Station': 'Car:Petrol',
        'Gas Station / Garage': 'Car:Petrol',
        'Government Building': 'Car:Parking', // e.g. City of York parking
        'Parking': 'Car:Parking',
        'Train': 'Travel:Rail',
        'Train Station': 'Travel:Rail',
    }, lookup('description', {
        'Car:Parking': /NCP |CAR PARK|PARKING|MANCHESTER AIRPORT|DONCASTER SHEFFIEL|LeedsCityCouncil|CITY OF YORK COUNC|CITIPARK|PARKMOBILE/i,
        'Car:Petrol': /EG HOLLINWOOD|MFG  PHOENIX|LOTOS|TESCO PFS|ADEL SF|PAY AT PUMP|PETROL|MALTHURST LIMITED|ESSO/,
        'Car:Service & MOT': 'R H SIRRELL',
        'Holiday:Travel': /RYANAIR/,
        'Travel:Bus': /AUT BILET|MPSA|MEGABUS|STAGECOACH SERVICE/,
        'Travel:Rail': /GVB|Trainline|TFL.gov|E\/TUNNEL/i,
        'Travel:Taxi': /UBER|bolt\.eu|AMBER/i,
        'Travel:Toll': /DART-CHARGE|^PPO /,
    })),
    family: foursquareCategory({
        'Convenience Store': 'House',
        'Garden Center': 'House:Garden',
        'Hardware Store': 'House:Improvement',
        'Pet Store': 'Pet Care',
        'Supermarket': 'House',
        'Warehouse Store': 'House',
    }, lookup('description', {
        'House:Improvement': /B & Q|BARGAIN TOOLS LIMITED/,
        'Pet Care:Accommodation': /MANSTON PET HOTEL|PAWSHAKE/,
        'Pet Care:Food': /ZooPlus/i,
        'Pet Care:Vet': 'VETERINARY',
    })),
    charity: 'Donations',
    gifts: 'Gifts',
};

const truelayer = {
    'Uncategorized': {
        'Cash & ATM': '',
        'Check': ''
    },
    'Entertainment': {
        'Arts': 'Entertainment:Arts & Culture',
        'Music': 'Leisure:Music Events',
        'Dating': '',
        'Movies & DVDs': 'Entertainment:Movies & DVDs',
        'Newspaper & Magazines': 'Entertainment:Newspaper & Magazines',
        'Social Club': '',
        'Sport': 'Entertainment:Sport & Games',
        'Games': 'Entertainment:Sport & Games'
    },
    'Education': {
        'Tuition': '',
        'Student Loan': '',
        'Books & Supplies': ''
    },
    'Shopping': {
        'Pets': 'Pet Care',
        'Groceries': 'Food:Groceries',
        'General': 'Shopping',
        'Clothing': 'Shopping:Clothing',
        'Home': '',
        'Books': 'Shopping:Books & Magazines',
        'Electronics & Software': '',
        'Hobbies': '',
        'Sporting Goods': ''
    },
    'Personal Care': {
        'Hair': 'Personal Care:Hair',
        'Laundry': '',
        'Beauty': 'Personal Care',
        'Spa & Massage': 'Personal Care'
    },
    'Health & Fitness': {
        'Dentist': 'Healthcare:Dental',
        'Doctor': 'Healthcare',
        'Eye care': 'Healthcare:Eyecare',
        'Pharmacy': 'Healthcare:Pharmacy',
        'Gym': 'Healthcare:Fitness',
        'Pets': 'Pet Care',
        'Sports': ''
    },
    'Food & Dining': {
        'Catering': '',
        'Coffee shops': 'Food:Eating Out',
        'Delivery': 'Food:Takeaway',
        'Fast Food': 'Food:Takeaway',
        'Restaurants': 'Food:Eating Out',
        'Bars': 'Nights Out'
    },
    'Gifts & Donations': {
        'Gift': 'Gifts',
        'Charity': 'Donations'
    },
    'Investments': {
        'Equities': '',
        'Bonds': '',
        'Bank products': '',
        'Retirement': '',
        'Annuities': '',
        'Real-estate': ''
    },
    'Bills and Utilities': {
        'Television': 'Bills:TV Licence',
        'Home Phone': '',
        'Internet': 'Bills:Internet',
        'Mobile Phone': 'Bills:Phone',
        'Utilities': 'Utilities'
    },
    'Auto & Transport': {
        'Auto Insurance': 'Car:Insurance',
        'Auto Payment': 'Car:Purchase',
        'Parking': 'Car:Parking',
        'Public transport': '',
        'Service & Auto Parts': '',
        'Taxi': 'Travel:Taxi',
        'Gas & Fuel': 'Car:Petrol'
    },
    'Travel': {
        'Air Travel': '',
        'Hotel': '',
        'Rental Car & Taxi': '',
        'Vacation': ''
    },
    'Fees & Charges': {
        'Service Fee': '',
        'Late Fee': '',
        'Finance Charge': '',
        'ATM Fee': '',
        'Bank Fee': '',
        'Commissions': ''
    },
    'Business Services': {
        'Advertising': '',
        'Financial Services': '',
        'Office Supplies': '',
        'Printing': '',
        'Shipping': '',
        'Legal': ''
    },
    'Personal Services': {
        'Advisory and Consulting': '',
        'Financial Services': '',
        'Lawyer': '',
        'Repairs & Maintenance': ''
    },
    'Taxes': {
        'Federal Tax': '',
        'State Tax': '',
        'Local Tax': '',
        'Sales Tax': '',
        'Property Tax': ''
    },
    'Gambling': {
        'Betting': 'Leisure:Betting',
        'Lottery': '',
        'Casino': ''
    },
    'Home': {
        'Rent': 'House:Rent',
        'Mortgage': 'House:Mortgage',
        'Secured loans': '',
        'Pension and insurances': '',
        'Pension payments': '',
        'Life insurance': '',
        'Buildings and contents insurance': 'House:Insurance',
        'Health insurance': ''
    }
};

module.exports = {search};
