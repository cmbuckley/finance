BEGIN {
    as["^CASH"] = "Cash"
    as["STUDENT LOANS CO"] = "Student Loan"
    as["HSBC CREDIT CARD"] = "Credit Card"
    as["MTG 400188[0-9]{4}9172"] = "Mortgage"
    as["SKY UK LIMITED"] = "Payslips"
    as["PAYPAL"] = "PayPal"
    as["^404401 [0-9]{4}3752"] = "HSBC ISA"
}
{
    if (substr($0, 1, 1) == "P") {
        m = substr($0, 2)

        for (a in as) {
            if (m == a || m ~ a) {
                print "L[" as[a] "]"
                break
            }
        }

        print "M" m
    } else if (substr($0, 1, 1) == "D") {
        print "D" substr($0, 5, 2) "/" substr($0, 2, 2) "/" substr($0, 8)
    } else {
        print
    }
}
